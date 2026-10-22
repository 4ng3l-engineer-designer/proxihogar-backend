// src/routes/technician.routes.ts
import { Router } from "express";
import { Role } from "@prisma/client";
import { TechnicianController } from "../controllers/technician.controller";
import { RequestController } from "../controllers/request.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const technicianController = new TechnicianController();
const requestController = new RequestController();

// GET /api/technicians/me/requests (protegido para WORKER)
// Debe ir antes de /:id para evitar colisión de ruta
router.get(
  "/me/requests",
  authenticate,
  requireRole(Role.WORKER),
  requestController.getWorkerRequests
);

// GET /api/technicians/nearby?lat=-12.2745&lng=-76.8711&radius=10
router.get("/nearby", technicianController.getNearby);

// GET /api/technicians/:id
router.get("/:id", technicianController.getById);

export default router;
