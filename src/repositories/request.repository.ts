// src/repositories/request.repository.ts
import { prisma } from "../utils/prisma";
import { Prisma, RequestStatus } from "@prisma/client";
import { HttpError } from "../utils/errors";

export type RequestWithTechnician = Prisma.RequestGetPayload<{
  include: {
    client: {
      select: {
        id: true;
        nombre: true;
        telefono: true;
      };
    };
    technician: {
      include: {
        user: {
          select: {
            telefono: true;
          };
        };
      };
    };
    statusLogs: {
      orderBy: {
        createdAt: "asc";
      };
    };
  };
}>;

export type WorkerRequestWithClient = Prisma.RequestGetPayload<{
  include: {
    client: {
      select: {
        id: true;
        nombre: true;
        telefono: true;
      };
    };
    statusLogs: {
      orderBy: {
        createdAt: "asc";
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
        status: RequestStatus.PENDING,
        latitude: data.latitude,
        longitude: data.longitude,
        statusLogs: {
          create: {
            status: RequestStatus.PENDING,
            changedBy: data.clientId,
          },
        },
      },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
          },
        },
        technician: {
          include: {
            user: {
              select: {
                telefono: true,
              },
            },
          },
        },
        statusLogs: {
          orderBy: {
            createdAt: "asc",
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
        client: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
          },
        },
        technician: {
          include: {
            user: {
              select: {
                telefono: true,
              },
            },
          },
        },
        statusLogs: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }

  async findById(id: string): Promise<RequestWithTechnician | null> {
    return prisma.request.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
          },
        },
        technician: {
          include: {
            user: {
              select: {
                telefono: true,
              },
            },
          },
        },
        statusLogs: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    newStatus: RequestStatus,
    changedBy: string
  ): Promise<RequestWithTechnician> {
    return prisma.$transaction(async (tx) => {
      await tx.requestStatusLog.create({
        data: {
          requestId: id,
          status: newStatus,
          changedBy,
        },
      });

      return tx.request.update({
        where: { id },
        data: {
          status: newStatus,
        },
        include: {
          client: {
            select: {
              id: true,
              nombre: true,
              telefono: true,
            },
          },
          technician: {
            include: {
              user: {
                select: {
                  telefono: true,
                },
              },
            },
          },
          statusLogs: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
    });
  }

  /**
   * Acepta una solicitud de forma atómica verificando dentro de la misma transacción
   * que el técnico no tenga ya otro servicio en curso (ACCEPTED, ON_THE_WAY o IN_PROGRESS).
   */
  async acceptRequestIfAvailable(
    id: string,
    technicianId: string,
    changedBy: string
  ): Promise<RequestWithTechnician> {
    return prisma.$transaction(async (tx) => {
      // Bloquear fila del técnico para serializar aceptaciones simultáneas
      await tx.$queryRaw`SELECT id FROM "technicians" WHERE id = ${technicianId} FOR UPDATE`;

      // Verificar que la solicitud siga en PENDING y asignada a este técnico
      const current = await tx.request.findUnique({
        where: { id },
        select: { id: true, status: true, technicianId: true },
      });

      if (!current || current.technicianId !== technicianId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      if (current.status !== RequestStatus.PENDING) {
        throw new HttpError(
          409,
          `No se puede pasar de ${current.status} a ${RequestStatus.ACCEPTED}.`
        );
      }

      // Verificar si el técnico ya tiene otra solicitud activa
      const activeRequest = await tx.request.findFirst({
        where: {
          technicianId,
          id: { not: id },
          status: {
            in: [
              RequestStatus.ACCEPTED,
              RequestStatus.ON_THE_WAY,
              RequestStatus.IN_PROGRESS,
            ],
          },
        },
        select: { id: true },
      });

      if (activeRequest) {
        throw new HttpError(
          409,
          "Ya tienes un servicio en curso. Finalízalo antes de aceptar otro."
        );
      }

      await tx.requestStatusLog.create({
        data: {
          requestId: id,
          status: RequestStatus.ACCEPTED,
          changedBy,
        },
      });

      return tx.request.update({
        where: { id },
        data: {
          status: RequestStatus.ACCEPTED,
        },
        include: {
          client: {
            select: {
              id: true,
              nombre: true,
              telefono: true,
            },
          },
          technician: {
            include: {
              user: {
                select: {
                  telefono: true,
                },
              },
            },
          },
          statusLogs: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
    });
  }

  /**
   * Pasa a EXPIRED todas las solicitudes en estado PENDING creadas antes de cutoff,
   * registrando un RequestStatusLog con changedBy = "system" por cada una.
   */
  async expirePendingRequestsBefore(cutoff: Date): Promise<
    Array<{
      id: string;
      status: RequestStatus;
      createdAt: Date;
      statusLogs: Array<{ status: RequestStatus; createdAt: Date }>;
    }>
  > {
    const candidates = await prisma.request.findMany({
      where: {
        status: RequestStatus.PENDING,
        createdAt: {
          lt: cutoff,
        },
      },
      select: { id: true },
    });

    const expiredList: Array<{
      id: string;
      status: RequestStatus;
      createdAt: Date;
      statusLogs: Array<{ status: RequestStatus; createdAt: Date }>;
    }> = [];

    for (const candidate of candidates) {
      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.request.updateMany({
          where: {
            id: candidate.id,
            status: RequestStatus.PENDING,
          },
          data: {
            status: RequestStatus.EXPIRED,
          },
        });

        if (res.count === 0) {
          return null;
        }

        await tx.requestStatusLog.create({
          data: {
            requestId: candidate.id,
            status: RequestStatus.EXPIRED,
            changedBy: "system",
          },
        });

        return tx.request.findUnique({
          where: { id: candidate.id },
          select: {
            id: true,
            status: true,
            createdAt: true,
            statusLogs: {
              orderBy: { createdAt: "asc" },
              select: {
                status: true,
                createdAt: true,
              },
            },
          },
        });
      });

      if (updated) {
        expiredList.push(updated);
      }
    }

    return expiredList;
  }

  async findByTechnicianId(technicianId: string): Promise<WorkerRequestWithClient[]> {
    return prisma.request.findMany({
      where: { technicianId },
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
          },
        },
        statusLogs: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }
}
