// src/types/review.types.ts
import { Review } from "@prisma/client";

export interface CreateReviewDto {
  calificacion: number;
  comentario: string;
  tags?: string[];
}

export interface ReviewItemResponse {
  id: string;
  autor: string;
  iniciales: string;
  calificacion: number;
  comentario: string;
  tags: string[];
  fecha: string;
}

export interface TechnicianReviewsListResponse {
  resenas: ReviewItemResponse[];
  hayMas: boolean;
}

export function formatReviewResponse(review: Review): ReviewItemResponse {
  return {
    id: review.id,
    autor: review.autor,
    iniciales: review.iniciales,
    calificacion: review.calificacion,
    comentario: review.comentario,
    tags: review.tags,
    fecha: review.createdAt.toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}
