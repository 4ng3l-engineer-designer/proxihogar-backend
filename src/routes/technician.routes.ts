// src/routes/technician.routes.ts
import { Router } from "express";
import { TechnicianController } from "../controllers/technician.controller";

const router = Router();
const technicianController = new TechnicianController();

// GET /api/technicians/nearby?lat=-12.2745&lng=-76.8711&radius=10
router.get("/nearby", technicianController.getNearby);

export default router;
