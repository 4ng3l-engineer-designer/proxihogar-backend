// src/repositories/review.repository.ts
import { Review } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { HttpError } from "../utils/errors";

export class ReviewRepository {
  async findByRequestId(requestId: string): Promise<Review | null> {
    return prisma.review.findUnique({
      where: { requestId },
    });
  }

  async createAndRecalculateTechnicianRating(params: {
    requestId: string;
    technicianId: string;
    clientId: string;
    autor: string;
    iniciales: string;
    calificacion: number;
    comentario: string;
    tags: string[];
  }): Promise<{ review: Review; calificacion: number; cantidadResenas: number }> {
    const {
      requestId,
      technicianId,
      clientId,
      autor,
      iniciales,
      calificacion,
      comentario,
      tags,
    } = params;

    return prisma.$transaction(async (tx) => {
      // Serializar actualizaciones de promedio para el técnico
      await tx.$queryRaw`SELECT id FROM "technicians" WHERE id = ${technicianId} FOR UPDATE`;

      const existing = await tx.review.findUnique({
        where: { requestId },
      });
      if (existing) {
        throw new HttpError(409, "Ya calificaste este servicio.");
      }

      const review = await tx.review.create({
        data: {
          requestId,
          technicianId,
          clientId,
          autor,
          iniciales,
          calificacion,
          comentario,
          tags,
        },
      });

      const aggregate = await tx.review.aggregate({
        where: { technicianId },
        _avg: { calificacion: true },
        _count: { id: true },
      });

      const rawAvg = aggregate._avg.calificacion ?? calificacion;
      const roundedAvg = Math.round((rawAvg + Number.EPSILON) * 10) / 10;
      const totalReviews = aggregate._count.id;

      await tx.technician.update({
        where: { id: technicianId },
        data: {
          calificacion: roundedAvg,
          cantidadResenas: totalReviews,
        },
      });

      return {
        review,
        calificacion: roundedAvg,
        cantidadResenas: totalReviews,
      };
    });
  }

  async findByTechnicianIdPaginated(
    technicianId: string,
    options: { limit: number; before?: string }
  ): Promise<{ resenas: Review[]; hayMas: boolean }> {
    const { limit, before } = options;

    if (before) {
      const cursorReview = await prisma.review.findFirst({
        where: { id: before, technicianId },
        select: { id: true },
      });
      if (!cursorReview) {
        throw new HttpError(404, "Reseña de referencia no encontrada.");
      }
    }

    const rows = await prisma.review.findMany({
      where: { technicianId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });

    const hayMas = rows.length > limit;
    const resenas = hayMas ? rows.slice(0, limit) : rows;

    return { resenas, hayMas };
  }
}
