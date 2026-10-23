// src/controllers/request.controller.ts
import { Request, Response } from "express";
import { RequestService } from "../services/request.service";
import { HttpError } from "../utils/errors";

export class RequestController {
  constructor(private readonly requestService = new RequestService()) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const clientId = req.user!.id;
      const result = await this.requestService.createRequest(clientId, req.body);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al crear solicitud de servicio:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const clientId = req.user!.id;
      const result = await this.requestService.getClientRequests(clientId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al listar solicitudes del cliente:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const clientId = req.user!.id;
      const result = await this.requestService.getRequestById(req.params.id, clientId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al obtener solicitud por ID:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { status } = req.body;
      const result = await this.requestService.updateStatus(
        req.params.id,
        status,
        userId,
        userRole
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al actualizar estado de solicitud:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  getWorkerRequests = async (req: Request, res: Response): Promise<void> => {
    try {
      const workerUserId = req.user!.id;
      const result = await this.requestService.getWorkerRequests(workerUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al listar solicitudes del técnico:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  getChatAccess = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const result = await this.requestService.getChatAccessForRequest(
        req.params.id,
        userId,
        userRole
      );
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al obtener acceso al chat:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };
}
