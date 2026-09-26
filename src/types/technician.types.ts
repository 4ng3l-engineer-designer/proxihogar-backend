// src/types/technician.types.ts

export interface ResenaResponse {
  id: string;
  autor: string;
  iniciales: string;
  calificacion: number;
  comentario: string;
  fecha: string;
  tags: string[];
}

export interface TecnicoResponse {
  id: string;
  nombre: string;
  iniciales: string;
  colorAvatar: string;
  especialidad: string;
  especialidades: string[];
  descripcion: string;
  verificado: boolean;
  calificacion: number;
  cantidadResenas: number;
  cantidadTrabajos: number;
  distanceKm: number; // Campo único de distancia (sin duplicados)
  tiempoLlegada: string;
  tarifaBase: number;
  ubicacion: string;
  experienciaAnios: number;
  resenas: ResenaResponse[];
}

export interface TecnicoProfileResponse {
  id: string;
  nombre: string;
  iniciales: string;
  colorAvatar: string;
  especialidad: string;
  especialidades: string[];
  descripcion: string;
  verificado: boolean;
  calificacion: number;
  cantidadResenas: number;
  cantidadTrabajos: number;
  tarifaBase: number;
  ubicacion: string;
  experienciaAnios: number;
  resenas: ResenaResponse[];
}

export interface NearbyQueryParams {
  lat: number;
  lng: number;
  radiusKm: number;
  especialidad?: string;
  verificado?: boolean;
  calificacionMin?: number;
  tarifaMax?: number;
}
