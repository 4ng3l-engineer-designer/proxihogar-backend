// src/jobs/expireRequests.ts
import { RequestStatus } from "@prisma/client";
import { RequestRepository } from "../repositories/request.repository";
import { buildEstadoResponse, isSystemTransitionAllowed } from "../utils/requestStatus";
import { getChatAccess } from "../utils/chatAccess";
import { emitRequestStatus } from "../realtime/socket";

const DEFAULT_EXPIRY_HOURS = 24;
const DEFAULT_EXPIRY_CHECK_INTERVAL_MS = 60 * 1000; // 1 minuto

/**
 * Lee REQUEST_EXPIRY_CHECK_MS (intervalo de revisión en ms, default 60000).
 * Si el valor no es un número positivo, avisa y usa el valor por defecto.
 */
export function getRequestExpiryCheckMs(): number {
  const raw = process.env.REQUEST_EXPIRY_CHECK_MS;
  if (raw === undefined || raw === "") {
    return DEFAULT_EXPIRY_CHECK_INTERVAL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[expireRequests] REQUEST_EXPIRY_CHECK_MS inválido ("${raw}"); usando ${DEFAULT_EXPIRY_CHECK_INTERVAL_MS} ms.`
    );
    return DEFAULT_EXPIRY_CHECK_INTERVAL_MS;
  }

  return parsed;
}

/**
 * Lee y valida REQUEST_EXPIRY_HOURS desde las variables de entorno (default 24).
 * Lanza un error claro si el valor configurado no es un número positivo.
 */
export function getRequestExpiryHours(): number {
  const raw = process.env.REQUEST_EXPIRY_HOURS;
  if (raw === undefined || raw === "") {
    return DEFAULT_EXPIRY_HOURS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `FATAL: REQUEST_EXPIRY_HOURS debe ser un número positivo (valor recibido: "${raw}").`
    );
  }

  return parsed;
}

/**
 * Pasa a EXPIRED todas las solicitudes PENDING creadas hace más de expiryHours,
 * registra RequestStatusLog con changedBy = "system" y emite request:status por Socket.io.
 */
export async function expirePendingRequests(
  expiryHours: number = getRequestExpiryHours()
): Promise<number> {
  if (!isSystemTransitionAllowed(RequestStatus.PENDING, RequestStatus.EXPIRED)) {
    return 0;
  }

  const requestRepository = new RequestRepository();
  const cutoff = new Date(Date.now() - expiryHours * 60 * 60 * 1000);
  const expiredRequests = await requestRepository.expirePendingRequestsBefore(cutoff);

  const chat = getChatAccess(RequestStatus.EXPIRED);

  for (const req of expiredRequests) {
    const estado = buildEstadoResponse({
      status: req.status,
      createdAt: req.createdAt,
      clientId: req.clientId,
      technicianUserId: req.technician.userId,
      statusLogs: req.statusLogs,
    });

    emitRequestStatus(req.id, {
      requestId: req.id,
      status: req.status,
      estado,
      chat,
    });
  }

  console.log(`[expireRequests] Solicitudes expiradas: ${expiredRequests.length}`);
  return expiredRequests.length;
}

/**
 * Ejecuta el job al arrancar el servidor y lo programa cada REQUEST_EXPIRY_CHECK_MS (default 1 minuto).
 */
export function startExpireRequestsJob(expiryHours: number): NodeJS.Timeout {
  expirePendingRequests(expiryHours).catch((err) => {
    console.error("[expireRequests] Error en ejecución inicial:", err);
  });

  return setInterval(() => {
    expirePendingRequests(expiryHours).catch((err) => {
      console.error("[expireRequests] Error en ejecución periódica:", err);
    });
  }, getRequestExpiryCheckMs());
}

