// src/routes/request.routes.ts
import { Router } from "express";
import { Role } from "@prisma/client";
import { RequestController } from "../controllers/request.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const requestController = new RequestController();

// Todas las rutas de /api/requests requieren autenticación y rol CLIENT
router.use(authenticate, requireRole(Role.CLIENT));

router.post("/", requestController.create);
router.get("/", requestController.getAll);
router.get("/:id", requestController.getById);

export default router;
