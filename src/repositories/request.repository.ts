// src/repositories/request.repository.ts
import { prisma } from "../utils/prisma";
import { Prisma } from "@prisma/client";

export type RequestWithTechnician = Prisma.RequestGetPayload<{
  include: {
    technician: {
      include: {
        user: {
          select: {
            telefono: true;
          };
        };
      };
    };
  };
}>;

export class RequestRepository {
  async create(data: {
    clientId: string;
    technicianId: string;
    direccion: string;
    tipoProblema: string;
    descripcion: string;
    radio?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<RequestWithTechnician> {
    return prisma.request.create({
      data: {
        clientId: data.clientId,
        technicianId: data.technicianId,
        direccion: data.direccion,
        tipoProblema: data.tipoProblema,
        descripcion: data.descripcion,
        radio: data.radio || "5km",
        latitude: data.latitude,
        longitude: data.longitude,
      },
      include: {
        technician: {
          include: {
            user: {
              select: {
                telefono: true,
              },
            },
          },
        },
      },
    });
  }

  async findByClientId(clientId: string): Promise<RequestWithTechnician[]> {
    return prisma.request.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: {
        technician: {
          include: {
            user: {
              select: {
                telefono: true,
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string): Promise<RequestWithTechnician | null> {
    return prisma.request.findUnique({
      where: { id },
      include: {
        technician: {
          include: {
            user: {
              select: {
                telefono: true,
              },
            },
          },
        },
      },
    });
  }
}
