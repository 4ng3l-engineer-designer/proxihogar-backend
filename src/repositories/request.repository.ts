// src/repositories/request.repository.ts
import { prisma } from "../utils/prisma";
import { Prisma, RequestStatus, Role } from "@prisma/client";
import { HttpError } from "../utils/errors";
import { isSystemTransitionAllowed, isTransitionAllowed } from "../utils/requestStatus";

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
    technician: {
      select: {
        userId: true;
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
            changedByRole: Role.CLIENT,
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

  /**
   * Ejecuta un cambio de estado atómico dentro de una transacción:
   * - Bloquea la fila del técnico (si aplica aceptación) y la de la solicitud con FOR UPDATE.
   * - Valida pertenencia, transición permitida (requestStatus.ts) y ocupación en aceptación.
   * - Actualiza la solicitud y crea el RequestStatusLog en la misma transacción.
   */
  async transitionStatus(params: {
    id: string;
    nextStatus: RequestStatus;
    userId: string;
    userRole: Role;
    technicianId?: string;
    motivo?: string | null;
  }): Promise<{ previousStatus: RequestStatus; updated: RequestWithTechnician }> {
    const { id, nextStatus, userId, userRole, technicianId, motivo } = params;

    return prisma.$transaction(async (tx) => {
      // Si el técnico está aceptando, bloquear su fila primero para serializar aceptaciones simultáneas
      if (userRole === Role.WORKER && nextStatus === RequestStatus.ACCEPTED && technicianId) {
        await tx.$queryRaw`SELECT id FROM "technicians" WHERE id = ${technicianId} FOR UPDATE`;
      }

      // Leer la solicitud con bloqueo de fila FOR UPDATE
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: RequestStatus; clientId: string; technicianId: string }>
      >`SELECT id, status, "clientId", "technicianId" FROM "requests" WHERE id = ${id} FOR UPDATE`;

      const current = rows[0];
      if (!current) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      // Validar pertenencia según rol
      if (userRole === Role.CLIENT && current.clientId !== userId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }
      if (userRole === Role.WORKER && current.technicianId !== technicianId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      // Validar transición permitida con la tabla de requestStatus.ts
      if (!isTransitionAllowed(userRole, current.status, nextStatus)) {
        throw new HttpError(
          409,
          `No se puede pasar de ${current.status} a ${nextStatus}.`
        );
      }

      // En aceptación, verificar que el técnico no tenga otra solicitud en curso
      if (userRole === Role.WORKER && nextStatus === RequestStatus.ACCEPTED && technicianId) {
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
      }

      await tx.requestStatusLog.create({
        data: {
          requestId: id,
          status: nextStatus,
          changedBy: userId,
          changedByRole: userRole,
          motivo: nextStatus === RequestStatus.CANCELLED ? (motivo ?? null) : null,
        },
      });

      const updated = await tx.request.update({
        where: { id },
        data: {
          status: nextStatus,
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

      return {
        previousStatus: current.status,
        updated,
      };
    });
  }

  /**
   * Pasa a EXPIRED todas las solicitudes en estado PENDING creadas antes de cutoff,
   * leyendo con FOR UPDATE, validando con requestStatus.ts y registrando el log en la misma transacción.
   */
  async expirePendingRequestsBefore(cutoff: Date): Promise<
    Array<{
      id: string;
      status: RequestStatus;
      clientId: string;
      createdAt: Date;
      technician: { userId: string };
      statusLogs: Array<{
        status: RequestStatus;
        changedBy: string;
        changedByRole: Role | null;
        motivo: string | null;
        createdAt: Date;
      }>;
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
      clientId: string;
      createdAt: Date;
      technician: { userId: string };
      statusLogs: Array<{
        status: RequestStatus;
        changedBy: string;
        changedByRole: Role | null;
        motivo: string | null;
        createdAt: Date;
      }>;
    }> = [];

    for (const candidate of candidates) {
      const updated = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; status: RequestStatus; createdAt: Date }>
        >`SELECT id, status, "createdAt" FROM "requests" WHERE id = ${candidate.id} FOR UPDATE`;

        const current = rows[0];
        if (!current || current.createdAt >= cutoff) {
          return null;
        }

        if (!isSystemTransitionAllowed(current.status, RequestStatus.EXPIRED)) {
          return null;
        }

        await tx.requestStatusLog.create({
          data: {
            requestId: candidate.id,
            status: RequestStatus.EXPIRED,
            changedBy: "system",
            changedByRole: null,
            motivo: null,
          },
        });

        return tx.request.update({
          where: { id: candidate.id },
          data: {
            status: RequestStatus.EXPIRED,
          },
          select: {
            id: true,
            status: true,
            clientId: true,
            createdAt: true,
            technician: {
              select: {
                userId: true,
              },
            },
            statusLogs: {
              orderBy: { createdAt: "asc" },
              select: {
                status: true,
                changedBy: true,
                changedByRole: true,
                motivo: true,
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

  async findActiveOnTheWayByTechnicianId(technicianId: string): Promise<{ id: string } | null> {
    return prisma.request.findFirst({
      where: {
        technicianId,
        status: RequestStatus.ON_THE_WAY,
      },
      select: {
        id: true,
      },
    });
  }

  async findByIdForTechnician(
    id: string,
    technicianId: string
  ): Promise<WorkerRequestWithClient | null> {
    return prisma.request.findFirst({
      where: { id, technicianId },
      include: {
        client: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
          },
        },
        technician: {
          select: {
            userId: true,
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
        technician: {
          select: {
            userId: true,
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
