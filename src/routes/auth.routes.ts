// src/routes/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por IP cada 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos desde esta IP. Por favor, intenta de nuevo en 15 minutos.",
  },
});

const router = Router();
const authController = new AuthController();

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.get("/me", authenticate, authController.getMe);

export default router;
