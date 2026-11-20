// src/jobs/expireRequests.ts
import { RequestStatus } from "@prisma/client";
import { RequestRepository } from "../repositories/request.repository";
import { STATUS_CONFIG, TOTAL_PASOS, isSystemTransitionAllowed } from "../utils/requestStatus";
import { getChatAccess } from "../utils/chatAccess";
import { emitRequestStatus } from "../realtime/socket";

const DEFAULT_EXPIRY_HOURS = 24;
const EXPIRY_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

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

  const meta = STATUS_CONFIG[RequestStatus.EXPIRED];
  const chat = getChatAccess(RequestStatus.EXPIRED);

  for (const req of expiredRequests) {
    const historial =
      req.statusLogs.length > 0
        ? req.statusLogs.map((log) => ({
            codigo: log.status,
            texto: STATUS_CONFIG[log.status]?.texto ?? log.status,
            fecha: log.createdAt,
          }))
        : [
            {
              codigo: req.status,
              texto: meta.texto,
              fecha: req.createdAt,
            },
          ];

    const estado = {
      codigo: req.status,
      texto: meta.texto,
      paso: meta.paso,
      totalPasos: TOTAL_PASOS,
      color: meta.color,
      historial,
    };

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
 * Ejecuta el job al arrancar el servidor y lo programa cada 10 minutos.
 */
export function startExpireRequestsJob(expiryHours: number): NodeJS.Timeout {
  expirePendingRequests(expiryHours).catch((err) => {
    console.error("[expireRequests] Error en ejecución inicial:", err);
  });

  return setInterval(() => {
    expirePendingRequests(expiryHours).catch((err) => {
      console.error("[expireRequests] Error en ejecución periódica:", err);
    });
  }, EXPIRY_CHECK_INTERVAL_MS);
}

