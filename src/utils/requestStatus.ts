// src/utils/requestStatus.ts
import { RequestStatus, Role } from "@prisma/client";

export interface StatusMeta {
  codigo: RequestStatus;
  texto: string;
  paso: number | null;
  color: string;
}

export const TOTAL_PASOS = 5;

export const STATUS_CONFIG: Record<RequestStatus, StatusMeta> = {
  [RequestStatus.PENDING]: {
    codigo: RequestStatus.PENDING,
    texto: "Pendiente de aceptación",
    paso: 1,
    color: "#EAB308", // Amarillo / Ámbar
  },
  [RequestStatus.ACCEPTED]: {
    codigo: RequestStatus.ACCEPTED,
    texto: "Aceptado",
    paso: 2,
    color: "#3B82F6", // Azul
  },
  [RequestStatus.ON_THE_WAY]: {
    codigo: RequestStatus.ON_THE_WAY,
    texto: "Técnico en camino",
    paso: 3,
    color: "#8B5CF6", // Morado / Púrpura
  },
  [RequestStatus.IN_PROGRESS]: {
    codigo: RequestStatus.IN_PROGRESS,
    texto: "Servicio en progreso",
    paso: 4,
    color: "#0EA5E9", // Cyan / Celeste
  },
  [RequestStatus.COMPLETED]: {
    codigo: RequestStatus.COMPLETED,
    texto: "Finalizado",
    paso: 5,
    color: "#10B981", // Verde esmeralda
  },
  [RequestStatus.CANCELLED]: {
    codigo: RequestStatus.CANCELLED,
    texto: "Cancelado",
    paso: null,
    color: "#EF4444", // Rojo
  },
};

/**
 * Transiciones permitidas para WORKER asignado:
 * PENDING -> ACCEPTED, PENDING -> CANCELLED
 * ACCEPTED -> ON_THE_WAY
 * ON_THE_WAY -> IN_PROGRESS
 * IN_PROGRESS -> COMPLETED
 */
export const WORKER_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [RequestStatus.ACCEPTED, RequestStatus.CANCELLED],
  [RequestStatus.ACCEPTED]: [RequestStatus.ON_THE_WAY],
  [RequestStatus.ON_THE_WAY]: [RequestStatus.IN_PROGRESS],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.COMPLETED],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.CANCELLED]: [],
};

/**
 * Transiciones permitidas para CLIENT dueño:
 * PENDING -> CANCELLED
 * ACCEPTED -> CANCELLED
 */
export const CLIENT_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [RequestStatus.CANCELLED],
  [RequestStatus.ACCEPTED]: [RequestStatus.CANCELLED],
  [RequestStatus.ON_THE_WAY]: [],
  [RequestStatus.IN_PROGRESS]: [],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.CANCELLED]: [],
};

export function isTransitionAllowed(role: Role, currentStatus: RequestStatus, nextStatus: RequestStatus): boolean {
  const transitions = role === Role.WORKER ? WORKER_ALLOWED_TRANSITIONS : CLIENT_ALLOWED_TRANSITIONS;
  const allowed = transitions[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export function getAllStatusList(): StatusMeta[] {
  return [
    STATUS_CONFIG[RequestStatus.PENDING],
    STATUS_CONFIG[RequestStatus.ACCEPTED],
    STATUS_CONFIG[RequestStatus.ON_THE_WAY],
    STATUS_CONFIG[RequestStatus.IN_PROGRESS],
    STATUS_CONFIG[RequestStatus.COMPLETED],
    STATUS_CONFIG[RequestStatus.CANCELLED],
  ];
}
