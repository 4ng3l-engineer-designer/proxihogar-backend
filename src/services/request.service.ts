// src/services/request.service.ts
import { RequestRepository, RequestWithTechnician } from "../repositories/request.repository";
import { TechnicianRepository } from "../repositories/technician.repository";
import { CreateRequestDto, RequestResponse, TecnicoAsignadoResponse } from "../types/request.types";
import { HttpError } from "../utils/errors";
import { calculateHaversineDistance, estimateArrivalTime, formatDistance } from "../utils/haversine";
import { formatTarifa, MONEDA } from "../utils/currency";

export class RequestService {
  constructor(
    private readonly requestRepository = new RequestRepository(),
    private readonly technicianRepository = new TechnicianRepository()
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

    // 4. Crear la solicitud con status PENDING
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

  private mapToResponse(request: RequestWithTechnician): RequestResponse {
    const tech = request.technician;

    const tecnico: TecnicoAsignadoResponse = {
      id: tech.id,
      nombre: tech.nombre,
      iniciales: tech.iniciales,
      colorAvatar: tech.colorAvatar,
      especialidad: tech.especialidad,
      verificado: tech.verificado,
      calificacion: tech.calificacion,
      cantidadResenas: tech.cantidadResenas,
      experienciaAnios: tech.experienciaAnios,
      telefono: tech.user?.telefono ?? null,
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
    };
  }
}
