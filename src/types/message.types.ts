// src/types/message.types.ts
import { MessageType, Role } from "@prisma/client";

export interface MessageArchivoResponse {
  url: string;
  mime: string;
  size: number;
  expiraEn: Date;
}

export interface MessageResponse {
  id: string;
  requestId: string;
  tipo: MessageType;
  contenido: string | null;
  archivo: MessageArchivoResponse | null;
  leido: boolean;
  createdAt: Date;
  senderId: string;
  senderRole: Role;
  esMio: boolean;
}

export interface MessagesListResponse {
  mensajes: MessageResponse[];
  hayMas: boolean;
}

export interface CreateMessageDto {
  contenido: string;
  idempotencyKey?: string;
}

export interface MessageSocketPayload {
  id: string;
  requestId: string;
  tipo: MessageType;
  contenido: string | null;
  archivo: MessageArchivoResponse | null;
  leido: boolean;
  createdAt: Date;
  senderId: string;
  senderRole: Role;
}

export interface UltimoMensajeResumen {
  contenido: string;
  fecha: Date;
  esMio: boolean;
}

export interface MarkReadResponse {
  leidos: number;
}
