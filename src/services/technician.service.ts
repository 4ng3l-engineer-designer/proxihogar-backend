// src/services/technician.service.ts
import { TechnicianRepository } from "../repositories/technician.repository";
import { NearbyQueryParams, TecnicoProfileResponse, TecnicoResponse } from "../types/technician.types";
import { calculateHaversineDistance, estimateArrivalTime } from "../utils/haversine";

export class TechnicianService {
  constructor(private readonly technicianRepository = new TechnicianRepository()) {}

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

        // Filtro opcional: tarifa máxima
        if (tarifaMax !== undefined && tech.tarifaBase > tarifaMax) {
          continue;
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
          colorAvatar: tech.colorAvatar,
          especialidad: tech.especialidad,
          especialidades: tech.especialidades,
          descripcion: tech.descripcion,
          verificado: tech.verificado,
          calificacion: tech.calificacion,
          cantidadResenas: tech.cantidadResenas,
          cantidadTrabajos: tech.cantidadTrabajos,
          distanceKm: distance,
          tiempoLlegada: estimateArrivalTime(distance),
          tarifaBase: tech.tarifaBase,
          ubicacion: tech.ubicacion,
          experienciaAnios: tech.experienciaAnios,
          resenas: formattedReviews,
        });
      }
    }

    // 3. Ordenar por distancia ascendente
    return nearbyList.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getTechnicianProfile(id: string): Promise<TecnicoProfileResponse | null> {
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

    return {
      id: tech.id,
      nombre: tech.nombre,
      iniciales: tech.iniciales,
      colorAvatar: tech.colorAvatar,
      especialidad: tech.especialidad,
      especialidades: tech.especialidades,
      descripcion: tech.descripcion,
      verificado: tech.verificado,
      calificacion: tech.calificacion,
      cantidadResenas: tech.cantidadResenas,
      cantidadTrabajos: tech.cantidadTrabajos,
      tarifaBase: tech.tarifaBase,
      ubicacion: tech.ubicacion,
      experienciaAnios: tech.experienciaAnios,
      resenas: formattedReviews,
    };
  }
}
