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

export type ActorRole = "CLIENT" | "WORKER" | "SYSTEM";

export interface HistorialEstadoItem {
  codigo: RequestStatus;
  texto: string;
  fecha: Date;
  por: ActorRole;
  motivo?: string;
}

export interface CancelacionInfo {
  por: ActorRole;
  motivo: string | null;
  fecha: Date;
}

export interface EstadoSolicitudResponse {
  codigo: RequestStatus;
  texto: string;
  paso: number | null;
  totalPasos: number;
  color: string;
  cancelacion: CancelacionInfo | null;
  historial: HistorialEstadoItem[];
}

export interface ChatAccessInfo {
  disponible: boolean;
  soloLectura: boolean;
  motivo: string | null;
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
  cliente?: ClienteSolicitudResponse;
  estado: EstadoSolicitudResponse;
  chat: ChatAccessInfo;
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
  chat: ChatAccessInfo;
}

export interface ContraparteChatResponse {
  id: string;
  nombre: string;
  iniciales: string;
  colorAvatar: string | null;
  fotoUrl: string | null;
  especialidad: string | null;
  disponible: boolean | null;
}

export interface ChatAccessResponse {
  requestId: string;
  status: RequestStatus;
  chat: ChatAccessInfo;
  miRol: "CLIENT" | "WORKER";
  contraparte: ContraparteChatResponse;
}

export type RequestRouteResponse =
  | {
      estado: "NO_EN_CAMINO";
      mensaje: string;
    }
  | {
      estado: "SIN_UBICACION";
      mensaje: string;
    }
  | {
      estado: "RUTA_NO_DISPONIBLE";
      mensaje: string;
      tecnico: {
        latitude: number;
        longitude: number;
        updatedAt: Date;
      };
      domicilio: {
        latitude: number | null;
        longitude: number | null;
      };
    }
  | {
      estado: "OK";
      tecnico: {
        latitude: number;
        longitude: number;
        updatedAt: Date;
      };
      domicilio: {
        latitude: number;
        longitude: number;
      };
      ruta: Array<[number, number]>;
      distanciaMetros: number;
      duracionSegundos: number;
      calculadoEn: Date;
    };
