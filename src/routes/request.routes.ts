// src/routes/request.routes.ts
import { Router } from "express";
import { Role } from "@prisma/client";
import { RequestController } from "../controllers/request.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const requestController = new RequestController();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas exclusivas para CLIENT
router.post("/", requireRole(Role.CLIENT), requestController.create);
router.get("/", requireRole(Role.CLIENT), requestController.getAll);
router.get("/:id", requireRole(Role.CLIENT), requestController.getById);

// Actualizar estado (disponible tanto para CLIENT dueño como para WORKER asignado)
router.patch("/:id/status", requestController.updateStatus);

export default router;
