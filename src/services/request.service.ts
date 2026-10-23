// src/services/request.service.ts
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
  TecnicoAsignadoResponse,
  WorkerRequestResponse,
} from "../types/request.types";
import { MessageResponse, MessagesListResponse } from "../types/message.types";
import { HttpError } from "../utils/errors";
import { calculateHaversineDistance, estimateArrivalTime, formatDistance } from "../utils/haversine";
import { formatTarifa, MONEDA } from "../utils/currency";
import { isTransitionAllowed, STATUS_CONFIG, TOTAL_PASOS } from "../utils/requestStatus";
import { getChatAccess, getInitials } from "../utils/chatAccess";
import { emitChatMessage, emitRequestStatus } from "../realtime/socket";

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
    userRole: Role
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

    // 2. Buscar la solicitud existente
    const request = await this.requestRepository.findById(id);
    if (!request) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    // 3. Validar permisos y transiciones según rol
    if (userRole === Role.CLIENT) {
      // Solo el dueño puede modificar
      if (request.clientId !== userId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      if (!isTransitionAllowed(Role.CLIENT, request.status, nextStatus)) {
        throw new HttpError(
          409,
          `No se puede pasar de ${request.status} a ${nextStatus}.`
        );
      }
    } else if (userRole === Role.WORKER) {
      // Buscar técnico asignado por userId
      const tech = await this.technicianRepository.findByUserId(userId);
      if (!tech || request.technicianId !== tech.id) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      if (!isTransitionAllowed(Role.WORKER, request.status, nextStatus)) {
        throw new HttpError(
          409,
          `No se puede pasar de ${request.status} a ${nextStatus}.`
        );
      }
    } else {
      throw new HttpError(403, "Rol no autorizado para cambiar el estado.");
    }

    // 4. Guardar cambio y registrar log
    const updatedRequest = await this.requestRepository.updateStatus(id, nextStatus, userId);
    const mappedResponse = this.mapToResponse(updatedRequest);

    // 5. Emitir cambio de estado a la sala de Socket.io
    emitRequestStatus(id, {
      requestId: mappedResponse.id,
      status: mappedResponse.status,
      estado: mappedResponse.estado,
      chat: mappedResponse.chat,
    });

    return mappedResponse;
  }

  async getWorkerRequests(userId: string): Promise<WorkerRequestResponse[]> {
    const tech = await this.technicianRepository.findByUserId(userId);
    if (!tech) {
      throw new HttpError(404, "Perfil de técnico no encontrado.");
    }

    const requests = await this.requestRepository.findByTechnicianId(tech.id);

    return requests.map((r) => ({
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
      estado: this.buildEstado(r.status, r.createdAt, r.statusLogs),
      chat: getChatAccess(r.status),
    }));
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

    return {
      mensajes: mensajes.map((m) => ({
        id: m.id,
        requestId: m.requestId,
        tipo: m.tipo,
        contenido: m.contenido,
        createdAt: m.createdAt,
        senderId: m.senderId,
        senderRole: m.senderRole,
        esMio: m.senderId === userId,
      })),
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
      createdAt: message.createdAt,
      senderId: message.senderId,
      senderRole: message.senderRole,
    });

    return {
      id: message.id,
      requestId: message.requestId,
      tipo: message.tipo,
      contenido: message.contenido,
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

  private buildEstado(
    status: RequestStatus,
    createdAt: Date,
    statusLogs?: { status: RequestStatus; createdAt: Date }[]
  ): EstadoSolicitudResponse {
    const meta = STATUS_CONFIG[status];
    let historial: HistorialEstadoItem[] = [];

    if (statusLogs && statusLogs.length > 0) {
      historial = statusLogs.map((log) => ({
        codigo: log.status,
        texto: STATUS_CONFIG[log.status]?.texto ?? log.status,
        fecha: log.createdAt,
      }));
    } else {
      // Si no tiene registros en request_status_logs (creadas antes de la migración),
      // devolver al menos un elemento con su status actual y la fecha createdAt
      historial = [
        {
          codigo: status,
          texto: meta.texto,
          fecha: createdAt,
        },
      ];
    }

    return {
      codigo: status,
      texto: meta.texto,
      paso: meta.paso,
      totalPasos: TOTAL_PASOS,
      color: meta.color,
      historial,
    };
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
      estado: this.buildEstado(request.status, request.createdAt, request.statusLogs),
      chat: getChatAccess(request.status),
    };
  }
}
