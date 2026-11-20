// src/utils/requestStatus.ts
import { RequestStatus, Role } from "@prisma/client";
import { ActorRole, CancelacionInfo, EstadoSolicitudResponse, HistorialEstadoItem } from "../types/request.types";

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
  [RequestStatus.EXPIRED]: {
    codigo: RequestStatus.EXPIRED,
    texto: "Expirado",
    paso: null,
    color: "#6B7280", // Gris
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
  [RequestStatus.EXPIRED]: [],
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
  [RequestStatus.EXPIRED]: [],
};

/**
 * Transiciones permitidas para el sistema (jobs automáticos):
 * PENDING -> EXPIRED
 */
export const SYSTEM_ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING]: [RequestStatus.EXPIRED],
  [RequestStatus.ACCEPTED]: [],
  [RequestStatus.ON_THE_WAY]: [],
  [RequestStatus.IN_PROGRESS]: [],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.CANCELLED]: [],
  [RequestStatus.EXPIRED]: [],
};

export function isTransitionAllowed(role: Role, currentStatus: RequestStatus, nextStatus: RequestStatus): boolean {
  const transitions = role === Role.WORKER ? WORKER_ALLOWED_TRANSITIONS : CLIENT_ALLOWED_TRANSITIONS;
  const allowed = transitions[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export function isSystemTransitionAllowed(currentStatus: RequestStatus, nextStatus: RequestStatus): boolean {
  const allowed = SYSTEM_ALLOWED_TRANSITIONS[currentStatus] || [];
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
    STATUS_CONFIG[RequestStatus.EXPIRED],
  ];
}

export function resolveLogActor(
  log: { changedBy: string; changedByRole?: Role | null },
  clientId?: string | null,
  technicianUserId?: string | null
): ActorRole {
  if (log.changedByRole === Role.CLIENT) return "CLIENT";
  if (log.changedByRole === Role.WORKER) return "WORKER";
  if (log.changedBy === "system") return "SYSTEM";
  if (clientId && log.changedBy === clientId) return "CLIENT";
  if (technicianUserId && log.changedBy === technicianUserId) return "WORKER";
  return "SYSTEM";
}

export function buildEstadoResponse(params: {
  status: RequestStatus;
  createdAt: Date;
  clientId?: string | null;
  technicianUserId?: string | null;
  statusLogs?: Array<{
    status: RequestStatus;
    changedBy: string;
    changedByRole?: Role | null;
    motivo?: string | null;
    createdAt: Date;
  }>;
}): EstadoSolicitudResponse {
  const { status, createdAt, clientId, technicianUserId, statusLogs } = params;
  const meta = STATUS_CONFIG[status];

  let historial: HistorialEstadoItem[] = [];
  if (statusLogs && statusLogs.length > 0) {
    historial = statusLogs.map((log) => {
      const item: HistorialEstadoItem = {
        codigo: log.status,
        texto: STATUS_CONFIG[log.status]?.texto ?? log.status,
        fecha: log.createdAt,
        por: resolveLogActor(log, clientId, technicianUserId),
      };
      if (log.motivo) {
        item.motivo = log.motivo;
      }
      return item;
    });
  } else {
    historial = [
      {
        codigo: status,
        texto: meta.texto,
        fecha: createdAt,
        por: status === RequestStatus.EXPIRED ? "SYSTEM" : "CLIENT",
      },
    ];
  }

  let cancelacion: CancelacionInfo | null = null;
  if (status === RequestStatus.CANCELLED || status === RequestStatus.EXPIRED) {
    // Último log correspondiente al estado actual
    const matchingLogs = historial.filter((h) => h.codigo === status);
    const lastLog = matchingLogs[matchingLogs.length - 1] ?? historial[historial.length - 1];
    cancelacion = {
      por: lastLog ? lastLog.por : "SYSTEM",
      motivo: lastLog?.motivo ?? null,
      fecha: lastLog ? lastLog.fecha : createdAt,
    };
  }

  return {
    codigo: status,
    texto: meta.texto,
    paso: meta.paso,
    totalPasos: TOTAL_PASOS,
    color: meta.color,
    cancelacion,
    historial,
  };
}
