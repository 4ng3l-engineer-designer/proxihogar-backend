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
  fotoUrl: string | null;
  colorAvatar: string;
  especialidad: string;
  verificado: boolean;
  calificacion: number;
  cantidadResenas: number;
  experienciaAnios: number;
  telefono: string | null;
  disponible: boolean;
  tarifaBase: number | null;
  moneda: string;
  tarifaTexto: string;
  distanceKm?: number;
  distanciaTexto?: string;
  tiempoLlegada?: string;
  calculoAproximado?: boolean;
}

export interface HistorialEstadoItem {
  codigo: RequestStatus;
  texto: string;
  fecha: Date;
}

export interface EstadoSolicitudResponse {
  codigo: RequestStatus;
  texto: string;
  paso: number | null;
  totalPasos: number;
  color: string;
  historial: HistorialEstadoItem[];
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
  estado: EstadoSolicitudResponse;
}

export interface ClienteSolicitudResponse {
  nombre: string;
  telefono: string | null;
}

export interface WorkerRequestResponse {
  id: string;
  status: RequestStatus;
  direccion: string;
  tipoProblema: string;
  descripcion: string;
  radio: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
  cliente: ClienteSolicitudResponse;
  estado: EstadoSolicitudResponse;
}
