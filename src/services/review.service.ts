// src/services/review.service.ts
import { RequestStatus, Role } from "@prisma/client";
import { ReviewRepository } from "../repositories/review.repository";
import { RequestRepository } from "../repositories/request.repository";
import { TechnicianRepository } from "../repositories/technician.repository";
import { HttpError } from "../utils/errors";
import { getInitials } from "../utils/chatAccess";
import { emitReviewNew } from "../realtime/socket";
import {
  ReviewItemResponse,
  TechnicianReviewsListResponse,
  formatReviewResponse,
} from "../types/review.types";

export class ReviewService {
  constructor(
    private readonly reviewRepository = new ReviewRepository(),
    private readonly requestRepository = new RequestRepository(),
    private readonly technicianRepository = new TechnicianRepository()
  ) {}

  async createReviewForRequest(
    requestId: string,
    clientId: string,
    body: unknown
  ): Promise<ReviewItemResponse> {
    const request = await this.requestRepository.findById(requestId);
    if (!request || request.clientId !== clientId) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    if (request.status !== RequestStatus.COMPLETED) {
      throw new HttpError(409, "Solo puedes calificar un servicio finalizado.");
    }

    const existing = await this.reviewRepository.findByRequestId(requestId);
    if (existing) {
      throw new HttpError(409, "Ya calificaste este servicio.");
    }

    const payload = (body ?? {}) as Record<string, unknown>;
    const { calificacion, comentario, tags } = payload;

    // Validar calificación: entero entre 1 y 5
    if (
      typeof calificacion !== "number" ||
      !Number.isInteger(calificacion) ||
      calificacion < 1 ||
      calificacion > 5
    ) {
      throw new HttpError(400, "La calificación debe ser un número entero entre 1 y 5.");
    }

    // Validar comentario: obligatorio, no vacío, máximo 500 caracteres
    if (typeof comentario !== "string") {
      throw new HttpError(400, "El comentario es obligatorio.");
    }
    const trimmedComentario = comentario.trim();
    if (trimmedComentario.length === 0) {
      throw new HttpError(400, "El comentario no puede estar vacío.");
    }
    if (trimmedComentario.length > 500) {
      throw new HttpError(400, "El comentario no puede superar los 500 caracteres.");
    }

    // Validar tags opcionales: array de strings, máx. 5 tags, cada uno máx. 20 caracteres
    let parsedTags: string[] = [];
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        throw new HttpError(400, "El campo 'tags' debe ser un arreglo de textos.");
      }
      if (tags.length > 5) {
        throw new HttpError(400, "Puedes incluir como máximo 5 tags.");
      }
      for (const tag of tags) {
        if (typeof tag !== "string") {
          throw new HttpError(400, "Cada tag debe ser un texto válido.");
        }
        const trimmedTag = tag.trim();
        if (trimmedTag.length === 0) {
          throw new HttpError(400, "Los tags no pueden estar vacíos.");
        }
        if (trimmedTag.length > 20) {
          throw new HttpError(400, "Cada tag puede tener como máximo 20 caracteres.");
        }
        parsedTags.push(trimmedTag);
      }
    }

    const autor = request.client.nombre;
    const iniciales = getInitials(autor);

    const { review } = await this.reviewRepository.createAndRecalculateTechnicianRating({
      requestId,
      technicianId: request.technicianId,
      clientId,
      autor,
      iniciales,
      calificacion,
      comentario: trimmedComentario,
      tags: parsedTags,
    });

    const formatted = formatReviewResponse(review);
    emitReviewNew(requestId, formatted);

    return formatted;
  }

  async getReviewForRequest(
    requestId: string,
    userId: string,
    userRole: Role
  ): Promise<ReviewItemResponse> {
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

    const review = await this.reviewRepository.findByRequestId(requestId);
    if (!review) {
      throw new HttpError(404, "Esta solicitud aún no tiene reseña.");
    }

    return formatReviewResponse(review);
  }

  async getTechnicianReviews(
    technicianId: string,
    options: { limit?: number; before?: string }
  ): Promise<TechnicianReviewsListResponse> {
    const tech = await this.technicianRepository.findById(technicianId);
    if (!tech) {
      throw new HttpError(404, "Técnico no encontrado.");
    }

    const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 50);
    const { resenas, hayMas } = await this.reviewRepository.findByTechnicianIdPaginated(
      technicianId,
      { limit, before: options.before }
    );

    return {
      resenas: resenas.map(formatReviewResponse),
      hayMas,
    };
  }
}
