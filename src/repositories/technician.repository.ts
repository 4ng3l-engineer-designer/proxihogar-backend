// src/repositories/technician.repository.ts
import { prisma } from "../utils/prisma";
import { Prisma } from "@prisma/client";

export type TechnicianWithReviews = Prisma.TechnicianGetPayload<{
  include: {
    resenas: true;
  };
}>;

export class TechnicianRepository {
  /**
   * Obtiene todos los técnicos con estado disponible = true, incluyendo sus reseñas.
   */
  async findAvailableTechnicians(): Promise<TechnicianWithReviews[]> {
    return prisma.technician.findMany({
      where: {
        disponible: true,
      },
      include: {
        resenas: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
  }
}
