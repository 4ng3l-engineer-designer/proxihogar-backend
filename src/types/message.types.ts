// src/types/message.types.ts
import { MessageType, Role } from "@prisma/client";

export interface MessageResponse {
  id: string;
  requestId: string;
  tipo: MessageType;
  contenido: string;
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
}

export interface MessageSocketPayload {
  id: string;
  requestId: string;
  tipo: MessageType;
  contenido: string;
  createdAt: Date;
  senderId: string;
  senderRole: Role;
}
