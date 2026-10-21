// src/types/request.types.ts
import { RequestStatus } from "@prisma/client";

export interface CreateRequestDto {
  technicianId: string;
  direccion: string;
  tipoProblema: string;
  descripcion: string;
  radio?: string;
  latitude?: number;
  longitude?: number;
}

export interface TecnicoAsignadoResponse {
  id: string;
  nombre: string;
  iniciales: string;
  colorAvatar: string;
  especialidad: string;
  verificado: boolean;
  calificacion: number;
  cantidadResenas: number;
  experienciaAnios: number;
  telefono: string | null;
  tarifaBase: number | null;
  moneda: string;
  tarifaTexto: string;
  distanceKm?: number;
  distanciaTexto?: string;
  tiempoLlegada?: string;
  calculoAproximado?: boolean;
}

export interface RequestResponse {
  id: string;
  status: RequestStatus;
  direccion: string;
  tipoProblema: string;
  descripcion: string;
  radio: string;
  createdAt: Date;
  updatedAt: Date;
  tecnico: TecnicoAsignadoResponse;
}
