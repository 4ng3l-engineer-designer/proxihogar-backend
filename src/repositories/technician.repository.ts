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

  /**
   * Obtiene el perfil completo de un técnico por ID con sus reseñas ordenadas por fecha descendente.
   */
  async findByIdWithReviews(id: string): Promise<TechnicianWithReviews | null> {
    return prisma.technician.findUnique({
      where: { id },
      include: {
        resenas: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Obtiene un técnico por ID con los datos de su usuario (teléfono).
   */
  async findById(id: string) {
    return prisma.technician.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            telefono: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene un técnico por el userId asociado a su cuenta.
   */
  async findByUserId(userId: string) {
    return prisma.technician.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            telefono: true,
          },
        },
      },
    });
  }
}
