// src/types/workOrder.types.ts
import { PaymentMethod, WorkOrderStatus } from "@prisma/client";
import { RequestResponse } from "./request.types";

export interface WorkOrderItemDto {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface CreateWorkOrderDto {
  manoDeObra: number;
  items: WorkOrderItemDto[];
}

export interface PayWorkOrderDto {
  paymentMethod: PaymentMethod;
  paymentReference?: string;
}

export interface OrdenTrabajoResumen {
  id: string;
  manoDeObra: number;
  items: WorkOrderItemDto[];
  total: number;
  totalTexto: string;
  moneda: string;
  status: WorkOrderStatus;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  paidAt: Date | null;
}

export interface WorkOrderResponse extends OrdenTrabajoResumen {
  requestId: string;
  tarifaTexto: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayWorkOrderResponse {
  orden: WorkOrderResponse;
  solicitud: RequestResponse;
}

