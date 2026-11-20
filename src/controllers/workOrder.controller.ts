// src/controllers/workOrder.controller.ts
import { Request, Response } from "express";
import { WorkOrderService } from "../services/workOrder.service";
import { HttpError } from "../utils/errors";

export class WorkOrderController {
  constructor(private readonly workOrderService = new WorkOrderService()) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const workerUserId = req.user!.id;
      const result = await this.workOrderService.createWorkOrder(
        req.params.id,
        workerUserId,
        req.body
      );
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al crear orden de trabajo:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  send = async (req: Request, res: Response): Promise<void> => {
    try {
      const workerUserId = req.user!.id;
      const result = await this.workOrderService.sendWorkOrder(req.params.id, workerUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al enviar orden de trabajo:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  getByRequestId = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const result = await this.workOrderService.getWorkOrder(req.params.id, userId, userRole);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al obtener orden de trabajo:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  pay = async (req: Request, res: Response): Promise<void> => {
    try {
      const clientId = req.user!.id;
      const result = await this.workOrderService.payWorkOrder(req.params.id, clientId, req.body);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al registrar pago de orden de trabajo:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };
}

