// src/services/workOrder.service.ts
import { PaymentMethod, Role, WorkOrder } from "@prisma/client";
import { WorkOrderRepository } from "../repositories/workOrder.repository";
import { RequestRepository } from "../repositories/request.repository";
import { TechnicianRepository } from "../repositories/technician.repository";
import { RequestService } from "./request.service";
import {
  OrdenTrabajoResumen,
  PayWorkOrderResponse,
  WorkOrderItemDto,
  WorkOrderResponse,
} from "../types/workOrder.types";
import { HttpError } from "../utils/errors";
import { formatTarifa, MONEDA } from "../utils/currency";
import { emitRequestStatus, emitWorkOrderPaid, emitWorkOrderSent } from "../realtime/socket";

export function mapOrdenTrabajoResumen(order: WorkOrder): OrdenTrabajoResumen {
  const items = Array.isArray(order.items) ? (order.items as unknown as WorkOrderItemDto[]) : [];
  return {
    id: order.id,
    manoDeObra: order.manoDeObra,
    items,
    total: order.total,
    totalTexto: formatTarifa(order.total),
    moneda: MONEDA,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt,
  };
}

export class WorkOrderService {
  constructor(
    private readonly workOrderRepository = new WorkOrderRepository(),
    private readonly requestRepository = new RequestRepository(),
    private readonly technicianRepository = new TechnicianRepository(),
    private readonly requestService = new RequestService()
  ) {}

  async createWorkOrder(
    requestId: string,
    workerUserId: string,
    body: { manoDeObra?: unknown; items?: unknown }
  ): Promise<WorkOrderResponse> {
    const tech = await this.technicianRepository.findByUserId(workerUserId);
    if (!tech) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    const { manoDeObra, items } = body;

    if (typeof manoDeObra !== "number" || !Number.isFinite(manoDeObra) || manoDeObra < 0) {
      throw new HttpError(400, "El campo 'manoDeObra' debe ser un número mayor o igual a 0.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpError(400, "El campo 'items' debe ser un arreglo no vacío.");
    }

    const sanitizedItems: WorkOrderItemDto[] = [];
    let itemsSum = 0;

    for (const item of items) {
      if (!item || typeof item !== "object") {
        throw new HttpError(400, "Cada ítem debe ser un objeto válido.");
      }

      const raw = item as Record<string, unknown>;
      if (typeof raw.descripcion !== "string" || raw.descripcion.trim() === "") {
        throw new HttpError(400, "Cada ítem debe tener una 'descripcion' no vacía.");
      }
      if (typeof raw.cantidad !== "number" || !Number.isFinite(raw.cantidad) || raw.cantidad <= 0) {
        throw new HttpError(400, "Cada ítem debe tener una 'cantidad' mayor a 0.");
      }
      if (
        typeof raw.precioUnitario !== "number" ||
        !Number.isFinite(raw.precioUnitario) ||
        raw.precioUnitario < 0
      ) {
        throw new HttpError(400, "Cada ítem debe tener un 'precioUnitario' mayor o igual a 0.");
      }

      const desc = raw.descripcion.trim();
      sanitizedItems.push({
        descripcion: desc,
        cantidad: raw.cantidad,
        precioUnitario: raw.precioUnitario,
      });
      itemsSum += raw.cantidad * raw.precioUnitario;
    }

    const total = Number((manoDeObra + itemsSum).toFixed(2));

    const created = await this.workOrderRepository.createForRequest({
      requestId,
      technicianId: tech.id,
      manoDeObra,
      items: sanitizedItems,
      total,
    });

    return this.mapWorkOrderResponse(created);
  }

  async sendWorkOrder(requestId: string, workerUserId: string): Promise<WorkOrderResponse> {
    const tech = await this.technicianRepository.findByUserId(workerUserId);
    if (!tech) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    const sent = await this.workOrderRepository.sendWorkOrder(requestId, tech.id);
    const mapped = this.mapWorkOrderResponse(sent);

    emitWorkOrderSent(requestId, mapped);
    return mapped;
  }

  async getWorkOrder(
    requestId: string,
    userId: string,
    userRole: Role
  ): Promise<WorkOrderResponse> {
    const request = await this.requestRepository.findById(requestId);
    if (!request) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    if (userRole === Role.CLIENT) {
      if (request.clientId !== userId) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }
    } else if (userRole === Role.WORKER) {
      const tech = await this.technicianRepository.findByUserId(userId);
      if (!tech || request.technicianId !== tech.id) {
        throw new HttpError(404, "Solicitud no encontrada.");
      }
    } else {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    const order = await this.workOrderRepository.findByRequestId(requestId);
    if (!order) {
      throw new HttpError(404, "No existe una orden de trabajo para esta solicitud.");
    }

    return this.mapWorkOrderResponse(order);
  }

  async payWorkOrder(
    requestId: string,
    clientId: string,
    body: { paymentMethod?: unknown; paymentReference?: unknown }
  ): Promise<PayWorkOrderResponse> {
    const { paymentMethod, paymentReference } = body;

    if (
      !paymentMethod ||
      typeof paymentMethod !== "string" ||
      !Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)
    ) {
      throw new HttpError(
        400,
        "El campo 'paymentMethod' debe ser EFECTIVO, YAPE, PLIN o TRANSFERENCIA."
      );
    }

    let validRef: string | null = null;
    if (paymentReference !== undefined && paymentReference !== null) {
      if (typeof paymentReference !== "string") {
        throw new HttpError(400, "El campo 'paymentReference' debe ser texto.");
      }
      const trimmed = paymentReference.trim();
      if (trimmed.length > 50) {
        throw new HttpError(400, "El campo 'paymentReference' no puede superar los 50 caracteres.");
      }
      validRef = trimmed.length > 0 ? trimmed : null;
    }

    const { order, request } = await this.workOrderRepository.payWorkOrderAndCompleteRequest({
      requestId,
      clientId,
      paymentMethod: paymentMethod as PaymentMethod,
      paymentReference: validRef,
    });

    const mappedOrder = this.mapWorkOrderResponse(order);
    const mappedRequest = this.requestService.mapRequestToResponse(request);
    mappedRequest.cliente = {
      nombre: request.client.nombre,
      telefono: request.client.telefono,
    };

    emitWorkOrderPaid(requestId, mappedOrder);
    emitRequestStatus(requestId, {
      requestId: mappedRequest.id,
      status: mappedRequest.status,
      estado: mappedRequest.estado,
      chat: mappedRequest.chat,
    });

    return {
      orden: mappedOrder,
      solicitud: mappedRequest,
    };
  }

  private mapWorkOrderResponse(order: WorkOrder): WorkOrderResponse {
    const resumen = mapOrdenTrabajoResumen(order);
    return {
      ...resumen,
      requestId: order.requestId,
      tarifaTexto: resumen.totalTexto,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

