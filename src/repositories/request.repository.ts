// src/repositories/request.repository.ts
import { prisma } from "../utils/prisma";
import { Prisma, RequestStatus } from "@prisma/client";

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
