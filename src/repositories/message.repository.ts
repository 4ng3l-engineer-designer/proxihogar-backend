// src/repositories/message.repository.ts
import { prisma } from "../utils/prisma";
import { Message, MessageType, Prisma, Role } from "@prisma/client";
import { HttpError } from "../utils/errors";

export class MessageRepository {
  async create(data: {
    requestId: string;
    senderId: string;
    senderRole: Role;
    contenido?: string | null;
    tipo?: MessageType;
    archivoPath?: string | null;
    archivoMime?: string | null;
    archivoSize?: number | null;
    duracionSegundos?: number | null;
    idempotencyKey?: string | null;
  }): Promise<Message> {
    return prisma.message.create({
      data: {
        requestId: data.requestId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        contenido: data.contenido ?? null,
        tipo: data.tipo ?? MessageType.TEXT,
        archivoPath: data.archivoPath ?? null,
        archivoMime: data.archivoMime ?? null,
        archivoSize: data.archivoSize ?? null,
        duracionSegundos: data.duracionSegundos ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
      },
    });
  }

  async findByIdempotencyKey(requestId: string, idempotencyKey: string): Promise<Message | null> {
    return prisma.message.findUnique({
      where: {
        requestId_idempotencyKey: {
          requestId,
          idempotencyKey,
        },
      },
    });
  }

  async markAsRead(requestId: string, readerUserId: string, readAt: Date): Promise<number> {
    const result = await prisma.message.updateMany({
      where: {
        requestId,
        senderId: { not: readerUserId },
        readAt: null,
      },
      data: {
        readAt,
      },
    });
    return result.count;
  }

  async getChatSummariesForRequests(
    requestIds: string[],
    currentUserId: string
  ): Promise<
    Map<
      string,
      {
        mensajesNoLeidos: number;
        ultimoMensaje: { contenido: string; fecha: Date; esMio: boolean } | null;
      }
    >
  > {
    const map = new Map<
      string,
      {
        mensajesNoLeidos: number;
        ultimoMensaje: { contenido: string; fecha: Date; esMio: boolean } | null;
      }
    >();

    if (requestIds.length === 0) {
      return map;
    }

    const [unreadGroups, allMessagesDesc] = await Promise.all([
      prisma.message.groupBy({
        by: ["requestId"],
        where: {
          requestId: { in: requestIds },
          senderId: { not: currentUserId },
          readAt: null,
        },
        _count: { _all: true },
      }),
      prisma.message.findMany({
        where: { requestId: { in: requestIds } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        distinct: ["requestId"],
        select: {
          requestId: true,
          tipo: true,
          contenido: true,
          senderId: true,
          createdAt: true,
        },
      }),
    ]);

    const unreadMap = new Map<string, number>();
    for (const g of unreadGroups) {
      unreadMap.set(g.requestId, g._count._all);
    }

    const lastMap = new Map<
      string,
      { contenido: string; fecha: Date; esMio: boolean }
    >();
    for (const m of allMessagesDesc) {
      const preview =
        m.tipo === MessageType.IMAGE
          ? "📷 Imagen"
          : m.tipo === MessageType.AUDIO
            ? "🎵 Audio"
            : (m.contenido ?? "").slice(0, 50);
      lastMap.set(m.requestId, {
        contenido: preview,
        fecha: m.createdAt,
        esMio: m.senderId === currentUserId,
      });
    }

    for (const reqId of requestIds) {
      map.set(reqId, {
        mensajesNoLeidos: unreadMap.get(reqId) ?? 0,
        ultimoMensaje: lastMap.get(reqId) ?? null,
      });
    }

    return map;
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
