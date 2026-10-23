// src/utils/chatAccess.ts
import { RequestStatus } from "@prisma/client";

export interface ChatAccessInfo {
  disponible: boolean;
  soloLectura: boolean;
  motivo: string | null;
}

export function getChatAccess(status: RequestStatus): ChatAccessInfo {
  switch (status) {
    case RequestStatus.PENDING:
      return {
        disponible: false,
        soloLectura: false,
        motivo: "Esperando que el técnico acepte el servicio",
      };
    case RequestStatus.ACCEPTED:
    case RequestStatus.ON_THE_WAY:
    case RequestStatus.IN_PROGRESS:
      return {
        disponible: true,
        soloLectura: false,
        motivo: null,
      };
    case RequestStatus.COMPLETED:
      return {
        disponible: true,
        soloLectura: true,
        motivo: "El servicio finalizó; el chat es solo de lectura",
      };
    case RequestStatus.CANCELLED:
      return {
        disponible: false,
        soloLectura: false,
        motivo: "El servicio fue cancelado",
      };
    default:
      return {
        disponible: false,
        soloLectura: false,
        motivo: "Estado no disponible para chat",
      };
  }
}

export function getInitials(nombre: string): string {
  if (!nombre) return "";
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
