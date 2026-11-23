// src/repositories/workOrder.repository.ts
import { prisma } from "../utils/prisma";
import { PaymentMethod, RequestStatus, Role, WorkOrder, WorkOrderStatus } from "@prisma/client";
import { HttpError } from "../utils/errors";
import { WorkOrderItemDto } from "../types/workOrder.types";
import { RequestWithTechnician } from "./request.repository";
import { isTransitionAllowed } from "../utils/requestStatus";

export class WorkOrderRepository {
  async findByRequestId(requestId: string): Promise<WorkOrder | null> {
    return prisma.workOrder.findUnique({
      where: { requestId },
    });
  }

  async createForRequest(params: {
    requestId: string;
    technicianId: string;
    manoDeObra: number;
    items: WorkOrderItemDto[];
    total: number;
  }): Promise<WorkOrder> {
    const { requestId, technicianId, manoDeObra, items, total } = params;

    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: RequestStatus; technicianId: string }>
      >`SELECT id, status, "technicianId" FROM "requests" WHERE id = ${requestId} FOR UPDATE`;

      const current = rows[0];
      if (!current || current.technicianId !== technicianId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      if (current.status !== RequestStatus.IN_PROGRESS) {
        throw new HttpError(
          409,
          "Solo puedes crear una orden de trabajo cuando el servicio está en progreso."
        );
      }

      const existing = await tx.workOrder.findUnique({
        where: { requestId },
        select: { id: true },
      });

      if (existing) {
        throw new HttpError(409, "Ya existe una orden de trabajo para esta solicitud.");
      }

      return tx.workOrder.create({
        data: {
          requestId,
          manoDeObra,
          items: items as unknown as object[],
          total,
          status: WorkOrderStatus.DRAFT,
        },
      });
    });
  }

  async sendWorkOrder(requestId: string, technicianId: string): Promise<WorkOrder> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; technicianId: string }>
      >`SELECT id, "technicianId" FROM "requests" WHERE id = ${requestId} FOR UPDATE`;

      const current = rows[0];
      if (!current || current.technicianId !== technicianId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      const order = await tx.workOrder.findUnique({
        where: { requestId },
      });

      if (!order) {
        throw new HttpError(404, "No existe una orden de trabajo para esta solicitud.");
      }

      if (order.status !== WorkOrderStatus.DRAFT) {
        throw new HttpError(
          409,
          `La orden de trabajo ya está en estado ${order.status} y no puede enviarse.`
        );
      }

      return tx.workOrder.update({
        where: { id: order.id },
        data: { status: WorkOrderStatus.SENT },
      });
    });
  }

  async payWorkOrderAndCompleteRequest(params: {
    requestId: string;
    clientId: string;
    paymentMethod: PaymentMethod;
    paymentReference: string | null;
  }): Promise<{ order: WorkOrder; request: RequestWithTechnician }> {
    const { requestId, clientId, paymentMethod, paymentReference } = params;

    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: RequestStatus; clientId: string }>
      >`SELECT id, status, "clientId" FROM "requests" WHERE id = ${requestId} FOR UPDATE`;

      const current = rows[0];
      if (!current || current.clientId !== clientId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }

      const order = await tx.workOrder.findUnique({
        where: { requestId },
      });

      if (!order) {
        throw new HttpError(404, "No existe una orden de trabajo para esta solicitud.");
      }

      if (order.status !== WorkOrderStatus.SENT) {
        throw new HttpError(
          409,
          `La orden de trabajo debe estar en estado SENT para pagarse (estado actual: ${order.status}).`
        );
      }

      if (!isTransitionAllowed(Role.WORKER, current.status, RequestStatus.COMPLETED)) {
        throw new HttpError(
          409,
          `No se puede completar la solicitud desde el estado ${current.status}.`
        );
      }

      const paidOrder = await tx.workOrder.update({
        where: { id: order.id },
        data: {
          status: WorkOrderStatus.PAID,
          paymentMethod,
          paymentReference,
          paidAt: new Date(),
        },
      });

      await tx.requestStatusLog.create({
        data: {
          requestId,
          status: RequestStatus.COMPLETED,
          changedBy: clientId,
          changedByRole: Role.CLIENT,
          motivo: null,
        },
      });

      const completedRequest = await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.COMPLETED },
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
          workOrder: true,
          review: true,
        },
      });

      return { order: paidOrder, request: completedRequest };
    });
  }
}

