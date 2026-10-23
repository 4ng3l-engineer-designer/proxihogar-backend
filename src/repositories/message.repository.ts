// src/repositories/message.repository.ts
import { prisma } from "../utils/prisma";
import { Message, MessageType, Prisma, Role } from "@prisma/client";
import { HttpError } from "../utils/errors";

export class MessageRepository {
  async create(data: {
    requestId: string;
    senderId: string;
    senderRole: Role;
    contenido: string;
    tipo?: MessageType;
  }): Promise<Message> {
    return prisma.message.create({
      data: {
        requestId: data.requestId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        contenido: data.contenido,
        tipo: data.tipo ?? MessageType.TEXT,
      },
    });
  }

  async findById(id: string): Promise<Message | null> {
    return prisma.message.findUnique({
      where: { id },
    });
  }

  async findByRequestId(
    requestId: string,
    options: { limit: number; before?: string }
  ): Promise<{ mensajes: Message[]; hayMas: boolean }> {
    const limit = options.limit;

    let cursorCondition: Prisma.MessageWhereInput = {};

    if (options.before) {
      const beforeMessage = await prisma.message.findUnique({
        where: { id: options.before },
      });

      if (!beforeMessage) {
        throw new HttpError(404, "El mensaje de referencia ('before') no existe.");
      }

      // Traer mensajes anteriores en el tiempo (o con id menor si son del mismo timestamp)
      cursorCondition = {
        OR: [
          { createdAt: { lt: beforeMessage.createdAt } },
          {
            createdAt: beforeMessage.createdAt,
            id: { lt: beforeMessage.id },
          },
        ],
      };
    }

    // Buscamos los más recientes anteriores en orden descendente
    const messagesDesc = await prisma.message.findMany({
      where: {
        requestId,
        ...cursorCondition,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
    });

    const hayMas = messagesDesc.length > limit;
    const sliced = hayMas ? messagesDesc.slice(0, limit) : messagesDesc;
    // Invertir para devolver del más antiguo al más reciente
    const chronologic = [...sliced].reverse();

    return {
      mensajes: chronologic,
      hayMas,
    };
  }
}
