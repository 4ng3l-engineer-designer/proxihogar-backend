// src/controllers/district.controller.ts
import { Request, Response } from "express";
import { DistrictService } from "../services/district.service";

export class DistrictController {
  constructor(private readonly districtService = new DistrictService()) {}

  getDistricts = (_req: Request, res: Response): void => {
    try {
      const districts = this.districtService.getDistricts();
      res.status(200).json(districts);
    } catch (error) {
      console.error("Error al obtener los distritos:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al obtener los distritos.",
      });
    }
  };
}
