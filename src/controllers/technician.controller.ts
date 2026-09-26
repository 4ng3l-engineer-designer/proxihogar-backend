// src/controllers/technician.controller.ts
import { Request, Response } from "express";
import { TechnicianService } from "../services/technician.service";

export class TechnicianController {
  constructor(private readonly technicianService = new TechnicianService()) {}

  getNearby = async (req: Request, res: Response): Promise<void> => {
    try {
      const { lat, lng, radius } = req.query;

      // Validación: lat y lng son obligatorios
      if (lat === undefined || lng === undefined || lat === "" || lng === "") {
        res.status(400).json({
          error: "Solicitud inválida: 'lat' y 'lng' son parámetros requeridos.",
        });
        return;
      }

      const parsedLat = parseFloat(lat as string);
      const parsedLng = parseFloat(lng as string);

      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        res.status(400).json({
          error: "Los parámetros 'lat' y 'lng' deben ser valores numéricos válidos.",
        });
        return;
      }

      // Validar rangos geográficos
      if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
        res.status(400).json({
          error: "Coordenadas fuera de rango válido (-90 a 90 para lat, -180 a 180 para lng).",
        });
        return;
      }

      // Radio por defecto: 10 km
      let radiusKm = 10;
      if (radius !== undefined && radius !== "") {
        const parsedRadius = parseFloat(radius as string);
        if (!isNaN(parsedRadius) && parsedRadius > 0) {
          radiusKm = parsedRadius;
        } else {
          res.status(400).json({
            error: "El parámetro 'radius' debe ser un número positivo.",
          });
          return;
        }
      }

      const technicians = await this.technicianService.getNearbyTechnicians({
        lat: parsedLat,
        lng: parsedLng,
        radiusKm,
      });

      // Retorna 200 con el array (vacío si no hay técnicos cerca)
      res.status(200).json(technicians);
    } catch (error) {
      console.error("Error al obtener técnicos cercanos:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };
}
