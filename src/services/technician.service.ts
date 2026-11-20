// src/services/technician.service.ts
import { TechnicianRepository, TechnicianWithReviews } from "../repositories/technician.repository";
import { RequestRepository } from "../repositories/request.repository";
import {
  NearbyQueryParams,
  TecnicoOwnProfileResponse,
  TecnicoProfileResponse,
  TecnicoResponse,
  UpdateLocationResponse,
  UpdateTechnicianProfileDto,
} from "../types/technician.types";
import { calculateHaversineDistance, estimateArrivalTime, formatDistance } from "../utils/haversine";
import { formatTarifa, MONEDA } from "../utils/currency";
import { HttpError } from "../utils/errors";
import { emitTechnicianLocation } from "../realtime/socket";
import { Prisma } from "@prisma/client";

const LOCATION_THROTTLE_MS = 5000;
const lastLocationSentAt = new Map<string, number>();

export class TechnicianService {
  constructor(
    private readonly technicianRepository = new TechnicianRepository(),
    private readonly requestRepository = new RequestRepository()
  ) {}

  async getNearbyTechnicians(params: NearbyQueryParams): Promise<TecnicoResponse[]> {
    const { lat, lng, radiusKm, especialidad, verificado, calificacionMin, tarifaMax } = params;

    // 1. Obtener técnicos disponibles de la base de datos
    const technicians = await this.technicianRepository.findAvailableTechnicians();

    if (!technicians || technicians.length === 0) {
      return [];
    }

    const nearbyList: TecnicoResponse[] = [];

    // 2. Calcular distancia con Haversine y filtrar dentro del radio y criterios opcionales
    for (const tech of technicians) {
      const distance = calculateHaversineDistance(lat, lng, tech.latitude, tech.longitude);

      if (distance <= radiusKm) {
        // Regla de cobertura del técnico: si radioCobertura está definido, la distancia no puede superarlo
        if (
          tech.radioCobertura !== null &&
          tech.radioCobertura !== undefined &&
          distance > tech.radioCobertura
        ) {
          continue;
        }

        // Filtro opcional: especialidad (coincidencia en especialidad principal o en array especialidades)
        if (especialidad) {
          const espQuery = especialidad.toLowerCase();
          const matchesPrincipal = tech.especialidad.toLowerCase().includes(espQuery);
          const matchesLista = tech.especialidades.some((esp) => esp.toLowerCase().includes(espQuery));

          if (!matchesPrincipal && !matchesLista) {
            continue;
          }
        }

        // Filtro opcional: verificado
        if (verificado === true && tech.verificado !== true) {
          continue;
        }

        // Filtro opcional: calificación mínima
        if (calificacionMin !== undefined && tech.calificacion < calificacionMin) {
          continue;
        }

        // Filtro opcional: tarifa máxima (los técnicos con tarifaBase null NO deben aparecer cuando se usa tarifaMax)
        if (tarifaMax !== undefined) {
          if (tech.tarifaBase === null || tech.tarifaBase === undefined || tech.tarifaBase > tarifaMax) {
            continue;
          }
        }

        // Formatear reseñas respetando la interfaz Resena
        const formattedReviews = tech.resenas.map((r) => ({
          id: r.id,
          autor: r.autor,
          iniciales: r.iniciales,
          calificacion: r.calificacion,
          comentario: r.comentario,
          fecha: r.createdAt.toLocaleDateString("es-PE", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          tags: r.tags,
        }));

        nearbyList.push({
          id: tech.id,
          nombre: tech.nombre,
          iniciales: tech.iniciales,
          fotoUrl: tech.fotoUrl ?? null,
          colorAvatar: tech.colorAvatar,
          especialidad: tech.especialidad,
          especialidades: tech.especialidades,
          descripcion: tech.descripcion,
          verificado: tech.verificado,
          calificacion: tech.calificacion,
          cantidadResenas: tech.cantidadResenas,
          cantidadTrabajos: tech.cantidadTrabajos,
          distanceKm: distance,
          distanciaTexto: formatDistance(distance),
          tiempoLlegada: estimateArrivalTime(distance),
          calculoAproximado: true,
          tarifaBase: tech.tarifaBase,
          moneda: MONEDA,
          tarifaTexto: formatTarifa(tech.tarifaBase),
          radioCobertura: tech.radioCobertura ?? null,
          ubicacion: tech.ubicacion,
          experienciaAnios: tech.experienciaAnios,
          latitude: tech.latitude,
          longitude: tech.longitude,
          resenas: formattedReviews,
        });
      }
    }

    // 3. Ordenar por distancia ascendente
    return nearbyList.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getTechnicianProfile(
    id: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<TecnicoProfileResponse | null> {
    const tech = await this.technicianRepository.findByIdWithReviews(id);

    if (!tech) {
      return null;
    }

    const formattedReviews = tech.resenas.map((r) => ({
      id: r.id,
      autor: r.autor,
      iniciales: r.iniciales,
      calificacion: r.calificacion,
      comentario: r.comentario,
      fecha: r.createdAt.toLocaleDateString("es-PE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      tags: r.tags,
    }));

    const profile: TecnicoProfileResponse = {
      id: tech.id,
      nombre: tech.nombre,
      iniciales: tech.iniciales,
      fotoUrl: tech.fotoUrl ?? null,
      colorAvatar: tech.colorAvatar,
      especialidad: tech.especialidad,
      especialidades: tech.especialidades,
      descripcion: tech.descripcion,
      verificado: tech.verificado,
      calificacion: tech.calificacion,
      cantidadResenas: tech.cantidadResenas,
      cantidadTrabajos: tech.cantidadTrabajos,
      tarifaBase: tech.tarifaBase,
      moneda: MONEDA,
      tarifaTexto: formatTarifa(tech.tarifaBase),
      radioCobertura: tech.radioCobertura ?? null,
      ubicacion: tech.ubicacion,
      experienciaAnios: tech.experienciaAnios,
      latitude: tech.latitude,
      longitude: tech.longitude,
      resenas: formattedReviews,
    };

    if (userLocation) {
      const distance = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        tech.latitude,
        tech.longitude
      );
      profile.distanceKm = distance;
      profile.distanciaTexto = formatDistance(distance);
      profile.tiempoLlegada = estimateArrivalTime(distance);
      profile.calculoAproximado = true;
    }

    return profile;
  }

  async getMyProfile(userId: string): Promise<TecnicoOwnProfileResponse> {
    const tech = await this.technicianRepository.findByUserIdWithReviews(userId);
    if (!tech) {
      throw new HttpError(404, "Perfil de técnico no encontrado.");
    }
    return this.mapOwnProfile(tech);
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateTechnicianProfileDto
  ): Promise<TecnicoOwnProfileResponse> {
    const existing = await this.technicianRepository.findByUserIdWithReviews(userId);
    if (!existing) {
      throw new HttpError(404, "Perfil de técnico no encontrado.");
    }

    const updateData: Prisma.TechnicianUpdateInput = {};

    if (dto.especialidad !== undefined) {
      if (typeof dto.especialidad !== "string" || dto.especialidad.trim() === "") {
        throw new HttpError(400, "El campo 'especialidad' debe ser un texto no vacío.");
      }
      updateData.especialidad = dto.especialidad.trim();
    }

    if (dto.descripcion !== undefined) {
      if (typeof dto.descripcion !== "string") {
        throw new HttpError(400, "El campo 'descripcion' debe ser un texto.");
      }
      updateData.descripcion = dto.descripcion.trim();
    }

    if (dto.tarifaBase !== undefined) {
      if (dto.tarifaBase === null) {
        updateData.tarifaBase = null;
      } else if (typeof dto.tarifaBase === "number" && Number.isFinite(dto.tarifaBase) && dto.tarifaBase >= 0) {
        updateData.tarifaBase = dto.tarifaBase;
      } else {
        throw new HttpError(400, "El campo 'tarifaBase' debe ser un número mayor o igual a 0 o null.");
      }
    }

    if (dto.radioCobertura !== undefined) {
      if (dto.radioCobertura === null) {
        updateData.radioCobertura = null;
      } else if (
        typeof dto.radioCobertura === "number" &&
        Number.isFinite(dto.radioCobertura) &&
        dto.radioCobertura > 0
      ) {
        updateData.radioCobertura = dto.radioCobertura;
      } else {
        throw new HttpError(
          400,
          "El campo 'radioCobertura' debe ser un número positivo mayor a 0 (en km) o null."
        );
      }
    }

    if (dto.ubicacion !== undefined) {
      if (typeof dto.ubicacion !== "string" || dto.ubicacion.trim() === "") {
        throw new HttpError(400, "El campo 'ubicacion' debe ser un texto no vacío.");
      }
      updateData.ubicacion = dto.ubicacion.trim();
    }

    if (dto.experienciaAnios !== undefined) {
      if (
        typeof dto.experienciaAnios !== "number" ||
        !Number.isInteger(dto.experienciaAnios) ||
        dto.experienciaAnios < 0
      ) {
        throw new HttpError(400, "El campo 'experienciaAnios' debe ser un número entero mayor o igual a 0.");
      }
      updateData.experienciaAnios = dto.experienciaAnios;
    }

    const hasLat = dto.latitude !== undefined;
    const hasLng = dto.longitude !== undefined;
    if (hasLat !== hasLng) {
      throw new HttpError(400, "Los campos 'latitude' y 'longitude' deben proporcionarse juntos.");
    }
    if (hasLat && hasLng) {
      if (
        typeof dto.latitude !== "number" ||
        typeof dto.longitude !== "number" ||
        !Number.isFinite(dto.latitude) ||
        !Number.isFinite(dto.longitude)
      ) {
        throw new HttpError(400, "Los campos 'latitude' y 'longitude' deben ser números válidos.");
      }
      if (dto.latitude < -90 || dto.latitude > 90 || dto.longitude < -180 || dto.longitude > 180) {
        throw new HttpError(400, "Coordenadas fuera de rango válido (-90 a 90 para lat, -180 a 180 para lng).");
      }
      updateData.latitude = dto.latitude;
      updateData.longitude = dto.longitude;
    }

    if (dto.fotoUrl !== undefined) {
      if (dto.fotoUrl !== null) {
        throw new HttpError(400, "Por ahora solo se acepta 'fotoUrl' con valor null.");
      }
      updateData.fotoUrl = null;
    }

    // Si el técnico ya estaba disponible y deja incompleta su especialidad o descripción, rechazar con 409
    const nextEspecialidad =
      typeof updateData.especialidad === "string" ? updateData.especialidad : existing.especialidad;
    const nextDescripcion =
      typeof updateData.descripcion === "string" ? updateData.descripcion : existing.descripcion;

    if (
      existing.disponible &&
      (nextEspecialidad === "Sin especificar" || nextDescripcion.trim() === "")
    ) {
      throw new HttpError(
        409,
        "No puedes dejar la especialidad como 'Sin especificar' ni la descripción vacía mientras estás disponible."
      );
    }

    const updated = await this.technicianRepository.updateByUserId(userId, updateData);
    return this.mapOwnProfile(updated);
  }

  async updateMyDisponibilidad(
    userId: string,
    disponibleInput: unknown
  ): Promise<TecnicoOwnProfileResponse> {
    if (typeof disponibleInput !== "boolean") {
      throw new HttpError(400, "El campo 'disponible' debe ser un valor booleano (true o false).");
    }

    const existing = await this.technicianRepository.findByUserIdWithReviews(userId);
    if (!existing) {
      throw new HttpError(404, "Perfil de técnico no encontrado.");
    }

    if (disponibleInput === true) {
      const especialidadValida =
        existing.especialidad.trim() !== "" && existing.especialidad.trim() !== "Sin especificar";
      const descripcionValida = existing.descripcion.trim() !== "";

      if (!especialidadValida || !descripcionValida) {
        throw new HttpError(
          409,
          "Debes completar tu especialidad y descripción antes de activarte como disponible."
        );
      }
    }

    const updated = await this.technicianRepository.updateByUserId(userId, {
      disponible: disponibleInput,
    });
    return this.mapOwnProfile(updated);
  }

  async updateMyLocation(
    userId: string,
    latitudeInput: unknown,
    longitudeInput: unknown
  ): Promise<UpdateLocationResponse> {
    if (
      latitudeInput === undefined ||
      latitudeInput === null ||
      longitudeInput === undefined ||
      longitudeInput === null
    ) {
      throw new HttpError(400, "Los campos 'latitude' y 'longitude' son obligatorios y deben enviarse juntos.");
    }

    if (
      typeof latitudeInput !== "number" ||
      typeof longitudeInput !== "number" ||
      !Number.isFinite(latitudeInput) ||
      !Number.isFinite(longitudeInput)
    ) {
      throw new HttpError(400, "Los campos 'latitude' y 'longitude' deben ser números válidos.");
    }

    if (
      latitudeInput < -90 ||
      latitudeInput > 90 ||
      longitudeInput < -180 ||
      longitudeInput > 180
    ) {
      throw new HttpError(
        400,
        "Coordenadas fuera de rango válido (-90 a 90 para latitude, -180 a 180 para longitude)."
      );
    }

    const tech = await this.technicianRepository.findByUserId(userId);
    if (!tech) {
      throw new HttpError(404, "Perfil de técnico no encontrado.");
    }

    // Buscar solicitud activa del técnico en ON_THE_WAY
    const activeOnTheWay = await this.requestRepository.findActiveOnTheWayByTechnicianId(tech.id);
    if (!activeOnTheWay) {
      throw new HttpError(
        409,
        "Solo puedes enviar tu ubicación mientras vas en camino a un servicio."
      );
    }

    // Límite de frecuencia: máximo 1 posición cada 5 segundos por técnico
    const nowMs = Date.now();
    const lastMemMs = lastLocationSentAt.get(tech.id) ?? 0;
    const lastDbMs = tech.ubicacionActualAt ? tech.ubicacionActualAt.getTime() : 0;
    const lastMs = Math.max(lastMemMs, lastDbMs);

    if (lastMs > 0 && nowMs - lastMs < LOCATION_THROTTLE_MS) {
      throw new HttpError(429, "Espera unos segundos antes de enviar otra ubicación.");
    }

    const updatedAt = new Date(nowMs);
    await this.technicianRepository.updateCurrentLocation(
      tech.id,
      latitudeInput,
      longitudeInput,
      updatedAt
    );

    lastLocationSentAt.set(tech.id, nowMs);

    // Emitir posición por Socket.io a la sala de la solicitud
    emitTechnicianLocation(activeOnTheWay.id, {
      requestId: activeOnTheWay.id,
      latitude: latitudeInput,
      longitude: longitudeInput,
      updatedAt,
    });

    return {
      latitude: latitudeInput,
      longitude: longitudeInput,
      updatedAt,
    };
  }

  private mapOwnProfile(tech: TechnicianWithReviews): TecnicoOwnProfileResponse {
    const formattedReviews = tech.resenas.map((r) => ({
      id: r.id,
      autor: r.autor,
      iniciales: r.iniciales,
      calificacion: r.calificacion,
      comentario: r.comentario,
      fecha: r.createdAt.toLocaleDateString("es-PE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      tags: r.tags,
    }));

    return {
      id: tech.id,
      nombre: tech.nombre,
      iniciales: tech.iniciales,
      fotoUrl: tech.fotoUrl ?? null,
      colorAvatar: tech.colorAvatar,
      especialidad: tech.especialidad,
      especialidades: tech.especialidades,
      descripcion: tech.descripcion,
      verificado: tech.verificado,
      calificacion: tech.calificacion,
      cantidadResenas: tech.cantidadResenas,
      cantidadTrabajos: tech.cantidadTrabajos,
      tarifaBase: tech.tarifaBase,
      moneda: MONEDA,
      tarifaTexto: formatTarifa(tech.tarifaBase),
      radioCobertura: tech.radioCobertura ?? null,
      ubicacion: tech.ubicacion,
      experienciaAnios: tech.experienciaAnios,
      latitude: tech.latitude,
      longitude: tech.longitude,
      disponible: tech.disponible,
      resenas: formattedReviews,
    };
  }
}
