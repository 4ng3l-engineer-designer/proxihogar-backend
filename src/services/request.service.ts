// src/services/request.service.ts
import crypto from "crypto";
import { MessageType, RequestStatus, Role } from "@prisma/client";
import { RequestRepository, RequestWithTechnician } from "../repositories/request.repository";
import { TechnicianRepository } from "../repositories/technician.repository";
import { MessageRepository } from "../repositories/message.repository";
import {
  ChatAccessResponse,
  ContraparteChatResponse,
  CreateRequestDto,
  EstadoSolicitudResponse,
  HistorialEstadoItem,
  RequestResponse,
  RequestRouteResponse,
  TecnicoAsignadoResponse,
  WorkerRequestResponse,
} from "../types/request.types";
import {
  MessageArchivoResponse,
  MessageResponse,
  MessagesListResponse,
} from "../types/message.types";
import { HttpError } from "../utils/errors";
import { calculateHaversineDistance, estimateArrivalTime, formatDistance } from "../utils/haversine";
import { formatTarifa, MONEDA } from "../utils/currency";
import { buildEstadoResponse } from "../utils/requestStatus";
import { getChatAccess, getInitials } from "../utils/chatAccess";
import { emitChatMessage, emitRequestStatus } from "../realtime/socket";
import { routingService } from "./routing.service";
import {
  createSignedStorageUrl,
  deleteFromStorage,
  uploadToStorage,
} from "../utils/storage";
import { MAX_IMAGE_SIZE_BYTES } from "../middlewares/upload.middleware";

function detectImageFormat(buffer: Buffer): { mime: string; ext: string } | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mime: "image/png", ext: "png" };
  }

  // WebP: "RIFF"...."WEBP"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

export class RequestService {
  constructor(
    private readonly requestRepository = new RequestRepository(),
    private readonly technicianRepository = new TechnicianRepository(),
    private readonly messageRepository = new MessageRepository()
  ) {}

  async createRequest(clientId: string, dto: CreateRequestDto): Promise<RequestResponse> {
    // 1. Validar campos obligatorios no vacíos
    if (!dto.direccion || typeof dto.direccion !== "string" || dto.direccion.trim() === "") {
      throw new HttpError(400, "El campo 'direccion' es obligatorio.");
    }
    if (!dto.tipoProblema || typeof dto.tipoProblema !== "string" || dto.tipoProblema.trim() === "") {
      throw new HttpError(400, "El campo 'tipoProblema' es obligatorio.");
    }
    if (!dto.descripcion || typeof dto.descripcion !== "string" || dto.descripcion.trim() === "") {
      throw new HttpError(400, "El campo 'descripcion' es obligatorio.");
    }
    if (!dto.technicianId || typeof dto.technicianId !== "string" || dto.technicianId.trim() === "") {
      throw new HttpError(400, "El campo 'technicianId' es obligatorio.");
    }

    // 2. Validar latitude y longitude si vienen
    const hasLat = dto.latitude !== undefined && dto.latitude !== null;
    const hasLng = dto.longitude !== undefined && dto.longitude !== null;

    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      throw new HttpError(400, "Los campos 'latitude' y 'longitude' deben proporcionarse juntos.");
    }

    let validLat: number | undefined;
    let validLng: number | undefined;

    if (hasLat && hasLng) {
      const latNum = Number(dto.latitude);
      const lngNum = Number(dto.longitude);

      if (isNaN(latNum) || isNaN(lngNum)) {
        throw new HttpError(400, "Los campos 'latitude' y 'longitude' deben ser números válidos.");
      }

      if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
        throw new HttpError(400, "Coordenadas fuera de rango válido (-90 a 90 para lat, -180 a 180 para lng).");
      }

      validLat = latNum;
      validLng = lngNum;
    }

    // 3. Validar existencia y disponibilidad del técnico
    const technician = await this.technicianRepository.findById(dto.technicianId.trim());
    if (!technician) {
      throw new HttpError(404, "Técnico no encontrado.");
    }

    if (technician.disponible !== true) {
      throw new HttpError(409, "El técnico no está disponible.");
    }

    // 4. Crear la solicitud con status PENDING e inicializar statusLogs
    const createdRequest = await this.requestRepository.create({
      clientId,
      technicianId: technician.id,
      direccion: dto.direccion.trim(),
      tipoProblema: dto.tipoProblema.trim(),
      descripcion: dto.descripcion.trim(),
      radio: dto.radio?.trim() || "5km",
      latitude: validLat,
      longitude: validLng,
    });

    return this.mapToResponse(createdRequest);
  }

  async getClientRequests(clientId: string): Promise<RequestResponse[]> {
    const requests = await this.requestRepository.findByClientId(clientId);
    return requests.map((r) => this.mapToResponse(r));
  }

  async getRequestById(id: string, clientId: string): Promise<RequestResponse> {
    const request = await this.requestRepository.findById(id);

    // Si no existe o pertenece a otro cliente, responder 404 (sin revelar existencia)
    if (!request || request.clientId !== clientId) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    return this.mapToResponse(request);
  }

  async updateStatus(
    id: string,
    newStatusInput: unknown,
    userId: string,
    userRole: Role,
    motivoInput?: unknown
  ): Promise<RequestResponse> {
    // 1. Validar que el nuevo status sea válido
    if (
      !newStatusInput ||
      typeof newStatusInput !== "string" ||
      !Object.values(RequestStatus).includes(newStatusInput as RequestStatus)
    ) {
      throw new HttpError(400, "Estado inválido o no proporcionado.");
    }

    const nextStatus = newStatusInput as RequestStatus;

    // 2. Validar motivo solo cuando el nuevo estado es CANCELLED (en otros estados se ignora)
    let validMotivo: string | null = null;
    if (
      nextStatus === RequestStatus.CANCELLED &&
      motivoInput !== undefined &&
      motivoInput !== null
    ) {
      if (typeof motivoInput !== "string") {
        throw new HttpError(400, "El campo 'motivo' debe ser texto.");
      }
      const trimmed = motivoInput.trim();
      if (trimmed.length > 200) {
        throw new HttpError(400, "El campo 'motivo' no puede superar los 200 caracteres.");
      }
      validMotivo = trimmed.length > 0 ? trimmed : null;
    }

    let assignedTechId: string | undefined;
    if (userRole === Role.WORKER) {
      const tech = await this.technicianRepository.findByUserId(userId);
      if (!tech) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }
      assignedTechId = tech.id;
    } else if (userRole !== Role.CLIENT) {
      throw new HttpError(403, "Rol no autorizado para cambiar el estado.");
    }

    // Ejecutar lectura con bloqueo FOR UPDATE, validación y guardado atómicamente en transacción
    const { previousStatus, updated } = await this.requestRepository.transitionStatus({
      id,
      nextStatus,
      userId,
      userRole,
      technicianId: assignedTechId,
      motivo: validMotivo,
    });

    const mappedResponse = this.mapToResponse(updated);
    mappedResponse.cliente = {
      nombre: updated.client.nombre,
      telefono: updated.client.telefono,
    };

    // Si la solicitud salió de ON_THE_WAY, limpiar la caché de ruta
    if (previousStatus === RequestStatus.ON_THE_WAY && nextStatus !== RequestStatus.ON_THE_WAY) {
      routingService.clearRouteCache(id);
    }

    // Emitir cambio de estado a la sala de Socket.io
    emitRequestStatus(id, {
      requestId: mappedResponse.id,
      status: mappedResponse.status,
      estado: mappedResponse.estado,
      chat: mappedResponse.chat,
    });

    return mappedResponse;
  }

  async getRequestRoute(requestId: string, userId: string): Promise<RequestRouteResponse> {
    const request = await this.requestRepository.findById(requestId);

    // Solo el cliente dueño puede consultar la ruta; otros reciben 404
    if (!request || request.clientId !== userId) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    if (request.status !== RequestStatus.ON_THE_WAY) {
      return {
        estado: "NO_EN_CAMINO",
        mensaje: "El técnico no está en camino.",
      };
    }

    const tech = request.technician;
    if (
      tech.ubicacionActualLat === null ||
      tech.ubicacionActualLat === undefined ||
      tech.ubicacionActualLng === null ||
      tech.ubicacionActualLng === undefined ||
      !tech.ubicacionActualAt
    ) {
      return {
        estado: "SIN_UBICACION",
        mensaje: "El técnico aún no comparte su ubicación.",
      };
    }

    const tecnicoPos = {
      latitude: tech.ubicacionActualLat,
      longitude: tech.ubicacionActualLng,
      updatedAt: tech.ubicacionActualAt,
    };

    if (request.latitude === null || request.longitude === null) {
      return {
        estado: "RUTA_NO_DISPONIBLE",
        mensaje: "No pudimos calcular la ruta en este momento.",
        tecnico: tecnicoPos,
        domicilio: {
          latitude: request.latitude,
          longitude: request.longitude,
        },
      };
    }

    const routeResult = await routingService.getRouteForRequest(
      request.id,
      tecnicoPos.latitude,
      tecnicoPos.longitude,
      request.latitude,
      request.longitude
    );

    if (!routeResult) {
      return {
        estado: "RUTA_NO_DISPONIBLE",
        mensaje: "No pudimos calcular la ruta en este momento.",
        tecnico: tecnicoPos,
        domicilio: {
          latitude: request.latitude,
          longitude: request.longitude,
        },
      };
    }

    return {
      estado: "OK",
      tecnico: tecnicoPos,
      domicilio: {
        latitude: request.latitude,
        longitude: request.longitude,
      },
      ruta: routeResult.ruta,
      distanciaMetros: routeResult.distanciaMetros,
      duracionSegundos: routeResult.duracionSegundos,
      calculadoEn: routeResult.calculadoEn,
    };
  }

  async getWorkerRequests(userId: string): Promise<WorkerRequestResponse[]> {
    const tech = await this.technicianRepository.findByUserId(userId);
    if (!tech) {
      throw new HttpError(404, "Perfil de técnico no encontrado.");
    }

    const requests = await this.requestRepository.findByTechnicianId(tech.id);
    return requests.map((r) => this.mapWorkerRequest(r));
  }

  async getWorkerRequestById(requestId: string, userId: string): Promise<WorkerRequestResponse> {
    const tech = await this.technicianRepository.findByUserId(userId);
    if (!tech) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    const request = await this.requestRepository.findByIdForTechnician(requestId, tech.id);
    if (!request) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    return this.mapWorkerRequest(request);
  }

  private mapWorkerRequest(r: import("../repositories/request.repository").WorkerRequestWithClient): WorkerRequestResponse {
    return {
      id: r.id,
      status: r.status,
      direccion: r.direccion,
      tipoProblema: r.tipoProblema,
      descripcion: r.descripcion,
      radio: r.radio,
      latitude: r.latitude,
      longitude: r.longitude,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      cliente: {
        nombre: r.client.nombre,
        telefono: r.client.telefono,
      },
      estado: buildEstadoResponse({
        status: r.status,
        createdAt: r.createdAt,
        clientId: r.client.id,
        technicianUserId: r.technician.userId,
        statusLogs: r.statusLogs,
      }),
      chat: getChatAccess(r.status),
    };
  }

  async getChatAccessForRequest(
    id: string,
    userId: string,
    userRole: Role
  ): Promise<ChatAccessResponse> {
    const request = await this.validateParticipant(id, userId, userRole);

    let miRol: "CLIENT" | "WORKER";
    let contraparte: ContraparteChatResponse;

    if (userRole === Role.CLIENT) {
      miRol = "CLIENT";
      contraparte = {
        id: request.technician.id,
        nombre: request.technician.nombre,
        iniciales: request.technician.iniciales,
        colorAvatar: request.technician.colorAvatar,
        fotoUrl: request.technician.fotoUrl ?? null,
        especialidad: request.technician.especialidad,
        disponible: request.technician.disponible,
      };
    } else {
      miRol = "WORKER";
      contraparte = {
        id: request.client.id,
        nombre: request.client.nombre,
        iniciales: getInitials(request.client.nombre),
        colorAvatar: null,
        fotoUrl: null,
        especialidad: null,
        disponible: null,
      };
    }

    const chat = getChatAccess(request.status);
    if (!chat.disponible) {
      throw new HttpError(403, chat.motivo || "El chat no está disponible para este servicio.");
    }

    return {
      requestId: request.id,
      status: request.status,
      chat,
      miRol,
      contraparte,
    };
  }

  async getMessages(
    requestId: string,
    userId: string,
    userRole: Role,
    options: { limit?: number; before?: string }
  ): Promise<MessagesListResponse> {
    const request = await this.validateParticipant(requestId, userId, userRole);

    const chat = getChatAccess(request.status);
    if (!chat.disponible) {
      throw new HttpError(403, chat.motivo || "El chat no está disponible para este servicio.");
    }

    const limit = Math.min(Math.max(Number(options.limit) || 30, 1), 100);
    const { mensajes, hayMas } = await this.messageRepository.findByRequestId(requestId, {
      limit,
      before: options.before,
    });

    const formattedMensajes: MessageResponse[] = await Promise.all(
      mensajes.map(async (m) => {
        let archivo: MessageArchivoResponse | null = null;
        if (m.tipo === MessageType.IMAGE && m.archivoPath) {
          const { url, expiraEn } = await createSignedStorageUrl(m.archivoPath);
          archivo = {
            url,
            mime: m.archivoMime ?? "image/jpeg",
            size: m.archivoSize ?? 0,
            expiraEn,
          };
        }

        return {
          id: m.id,
          requestId: m.requestId,
          tipo: m.tipo,
          contenido: m.contenido,
          archivo,
          createdAt: m.createdAt,
          senderId: m.senderId,
          senderRole: m.senderRole,
          esMio: m.senderId === userId,
        };
      })
    );

    return {
      mensajes: formattedMensajes,
      hayMas,
    };
  }

  async createMessage(
    requestId: string,
    userId: string,
    userRole: Role,
    contenidoInput: unknown
  ): Promise<MessageResponse> {
    const request = await this.validateParticipant(requestId, userId, userRole);

    const chat = getChatAccess(request.status);
    if (!chat.disponible) {
      throw new HttpError(403, chat.motivo || "El chat no está disponible para este servicio.");
    }

    if (chat.soloLectura) {
      throw new HttpError(409, "El servicio finalizó; el chat es solo de lectura");
    }

    if (typeof contenidoInput !== "string") {
      throw new HttpError(400, "El campo 'contenido' es obligatorio.");
    }

    const trimmed = contenidoInput.trim();
    if (trimmed.length === 0) {
      throw new HttpError(400, "El campo 'contenido' no puede estar vacío.");
    }

    if (trimmed.length > 1000) {
      throw new HttpError(400, "El contenido no puede superar los 1000 caracteres.");
    }

    const message = await this.messageRepository.create({
      requestId,
      senderId: userId,
      senderRole: userRole,
      tipo: MessageType.TEXT,
      contenido: trimmed,
    });

    // Emitir mensaje en tiempo real a la sala de Socket.io
    emitChatMessage(requestId, {
      id: message.id,
      requestId: message.requestId,
      tipo: message.tipo,
      contenido: message.contenido,
      archivo: null,
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderRole: message.senderRole,
    });

    return {
      id: message.id,
      requestId: message.requestId,
      tipo: message.tipo,
      contenido: message.contenido,
      archivo: null,
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderRole: message.senderRole,
      esMio: true,
    };
  }

  async createImageMessage(
    requestId: string,
    userId: string,
    userRole: Role,
    file: Express.Multer.File | undefined,
    contenidoInput: unknown
  ): Promise<MessageResponse> {
    const request = await this.validateParticipant(requestId, userId, userRole);

    const chat = getChatAccess(request.status);
    if (!chat.disponible) {
      throw new HttpError(403, chat.motivo || "El chat no está disponible para este servicio.");
    }

    if (chat.soloLectura) {
      throw new HttpError(409, "El servicio finalizó; el chat es solo de lectura");
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new HttpError(400, "El campo 'imagen' es obligatorio.");
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES || file.buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new HttpError(413, "La imagen supera el tamaño máximo permitido de 5 MB.");
    }

    const detected = detectImageFormat(file.buffer);
    if (!detected) {
      throw new HttpError(
        415,
        "Formato de imagen no permitido. Solo se aceptan archivos JPEG, PNG y WebP válidos."
      );
    }

    let caption: string | null = null;
    if (contenidoInput !== undefined && contenidoInput !== null) {
      if (typeof contenidoInput !== "string") {
        throw new HttpError(400, "El campo 'contenido' debe ser texto.");
      }
      const trimmed = contenidoInput.trim();
      if (trimmed.length > 1000) {
        throw new HttpError(400, "El contenido no puede superar los 1000 caracteres.");
      }
      caption = trimmed.length > 0 ? trimmed : null;
    }

    const archivoPath = `requests/${requestId}/${crypto.randomUUID()}.${detected.ext}`;

    // 1. Subir archivo al bucket de Supabase Storage
    try {
      await uploadToStorage(archivoPath, file.buffer, detected.mime);
    } catch {
      throw new HttpError(
        502,
        "No se pudo subir la imagen en este momento. Intenta de nuevo."
      );
    }

    // 2. Guardar mensaje en la base de datos (si falla, borrar archivo subido)
    let message;
    try {
      message = await this.messageRepository.create({
        requestId,
        senderId: userId,
        senderRole: userRole,
        tipo: MessageType.IMAGE,
        contenido: caption,
        archivoPath,
        archivoMime: detected.mime,
        archivoSize: file.buffer.length,
      });
    } catch (dbError) {
      await deleteFromStorage([archivoPath]);
      throw dbError;
    }

    // 3. Generar URL firmada válida por 1 hora
    const { url, expiraEn } = await createSignedStorageUrl(archivoPath);
    const archivo: MessageArchivoResponse = {
      url,
      mime: detected.mime,
      size: file.buffer.length,
      expiraEn,
    };

    // 4. Emitir por Socket.io a la sala de la solicitud
    emitChatMessage(requestId, {
      id: message.id,
      requestId: message.requestId,
      tipo: message.tipo,
      contenido: message.contenido,
      archivo,
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderRole: message.senderRole,
    });

    return {
      id: message.id,
      requestId: message.requestId,
      tipo: message.tipo,
      contenido: message.contenido,
      archivo,
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderRole: message.senderRole,
      esMio: true,
    };
  }

  private async validateParticipant(
    requestId: string,
    userId: string,
    userRole: Role
  ): Promise<RequestWithTechnician> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    if (userRole === Role.CLIENT) {
      if (request.clientId !== userId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }
    } else if (userRole === Role.WORKER) {
      const tech = await this.technicianRepository.findByUserId(userId);
      if (!tech || request.technicianId !== tech.id) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }
    } else {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    return request;
  }

  private mapToResponse(request: RequestWithTechnician): RequestResponse {
    const tech = request.technician;

    const tecnico: TecnicoAsignadoResponse = {
      id: tech.id,
      nombre: tech.nombre,
      iniciales: tech.iniciales,
      fotoUrl: tech.fotoUrl ?? null,
      colorAvatar: tech.colorAvatar,
      especialidad: tech.especialidad,
      verificado: tech.verificado,
      calificacion: tech.calificacion,
      cantidadResenas: tech.cantidadResenas,
      experienciaAnios: tech.experienciaAnios,
      telefono: tech.user?.telefono ?? null,
      disponible: tech.disponible,
      tarifaBase: tech.tarifaBase,
      moneda: MONEDA,
      tarifaTexto: formatTarifa(tech.tarifaBase),
    };

    // Si la solicitud tiene latitude y longitude, calcular distancia y tiempo estimado
    if (request.latitude !== null && request.longitude !== null && tech.latitude !== null && tech.longitude !== null) {
      const distance = calculateHaversineDistance(
        request.latitude,
        request.longitude,
        tech.latitude,
        tech.longitude
      );

      tecnico.distanceKm = distance;
      tecnico.distanciaTexto = formatDistance(distance);
      tecnico.tiempoLlegada = estimateArrivalTime(distance);
      tecnico.calculoAproximado = true;
    }

    return {
      id: request.id,
      status: request.status,
      direccion: request.direccion,
      tipoProblema: request.tipoProblema,
      descripcion: request.descripcion,
      radio: request.radio,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      tecnico,
      estado: buildEstadoResponse({
        status: request.status,
        createdAt: request.createdAt,
        clientId: request.clientId,
        technicianUserId: tech.userId,
        statusLogs: request.statusLogs,
      }),
      chat: getChatAccess(request.status),
    };
  }
}
