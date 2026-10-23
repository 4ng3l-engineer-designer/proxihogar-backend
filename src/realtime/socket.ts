// src/realtime/socket.ts
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { RequestRepository } from "../repositories/request.repository";
import { TechnicianRepository } from "../repositories/technician.repository";
import { getChatAccess } from "../utils/chatAccess";
import { MessageSocketPayload } from "../types/message.types";
import { JwtPayload } from "../types/auth.types";

interface SocketUser {
  id: string;
  role: Role;
}

let io: SocketIOServer | null = null;
const requestRepository = new RequestRepository();
const technicianRepository = new TechnicianRepository();

export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH"],
    },
  });

  // Autenticación en el handshake con JWT
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("Autenticación requerida: token no proporcionado."));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error("Error interno del servidor de autenticación."));
    }

    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      if (!decoded || !decoded.sub || !decoded.role) {
        return next(new Error("Token inválido o malformado."));
      }

      socket.data.user = {
        id: decoded.sub,
        role: decoded.role,
      };
      next();
    } catch {
      return next(new Error("Token inválido o expirado."));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as SocketUser;

    // Unirse a la sala de chat de una solicitud
    socket.on(
      "chat:join",
      async (
        data: { requestId?: string },
        callback?: (res: { ok: boolean; error?: string }) => void
      ) => {
        try {
          const requestId = data?.requestId;
          if (!requestId || typeof requestId !== "string") {
            if (callback) callback({ ok: false, error: "requestId es obligatorio." });
            return;
          }

          const request = await requestRepository.findById(requestId);
          if (!request) {
            if (callback) callback({ ok: false, error: "Solicitud no encontrada." });
            return;
          }

          // Validación de participante
          if (user.role === Role.CLIENT) {
            if (request.clientId !== user.id) {
              if (callback) callback({ ok: false, error: "No eres participante de esta solicitud." });
              return;
            }
          } else if (user.role === Role.WORKER) {
            const tech = await technicianRepository.findByUserId(user.id);
            if (!tech || request.technicianId !== tech.id) {
              if (callback) callback({ ok: false, error: "No eres participante de esta solicitud." });
              return;
            }
          } else {
            if (callback) callback({ ok: false, error: "Rol no autorizado para acceder al chat." });
            return;
          }

          // Validación de disponibilidad del chat
          const chat = getChatAccess(request.status);
          if (!chat.disponible) {
            if (callback) callback({ ok: false, error: chat.motivo || "El chat no está disponible." });
            return;
          }

          // Unirse a la sala
          socket.join(`request:${requestId}`);
          if (callback) callback({ ok: true });
        } catch (error) {
          console.error("Error en evento chat:join:", error);
          if (callback) callback({ ok: false, error: "Error interno al unirse a la sala." });
        }
      }
    );

    // Salir de la sala de chat
    socket.on("chat:leave", (data: { requestId?: string }) => {
      const requestId = data?.requestId;
      if (requestId && typeof requestId === "string") {
        socket.leave(`request:${requestId}`);
      }
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

export function emitChatMessage(requestId: string, message: MessageSocketPayload): void {
  if (io) {
    io.to(`request:${requestId}`).emit("chat:message", message);
  }
}

export function emitRequestStatus(
  requestId: string,
  payload: { requestId: string; status: string; estado: any; chat: any }
): void {
  if (io) {
    io.to(`request:${requestId}`).emit("request:status", payload);
  }
}
