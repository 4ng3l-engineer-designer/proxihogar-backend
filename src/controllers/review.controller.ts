// src/controllers/review.controller.ts
import { Request, Response } from "express";
import { ReviewService } from "../services/review.service";
import { HttpError } from "../utils/errors";

export class ReviewController {
  constructor(private readonly reviewService = new ReviewService()) {}

  createForRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const requestId = req.params.id as string;
      const clientId = req.user!.id;

      const review = await this.reviewService.createReviewForRequest(
        requestId,
        clientId,
        req.body
      );

      res.status(201).json(review);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error en POST /api/requests/:id/review:", error);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  };

  getForRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const requestId = req.params.id as string;
      const { id: userId, role } = req.user!;

      const review = await this.reviewService.getReviewForRequest(requestId, userId, role);
      res.status(200).json(review);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error en GET /api/requests/:id/review:", error);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  };

  getTechnicianReviews = async (req: Request, res: Response): Promise<void> => {
    try {
      const technicianId = req.params.id as string;
      const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
      const beforeParam =
        typeof req.query.before === "string" && req.query.before.trim() !== ""
          ? req.query.before.trim()
          : undefined;

      if (limitParam !== undefined && (isNaN(limitParam) || limitParam < 1)) {
        res.status(400).json({ error: "El parámetro 'limit' debe ser un número entero positivo." });
        return;
      }

      const result = await this.reviewService.getTechnicianReviews(technicianId, {
        limit: limitParam,
        before: beforeParam,
      });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error en GET /api/technicians/:id/reviews:", error);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  };
}
