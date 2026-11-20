// src/routes/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 intentos fallidos por IP cada 15 minutos
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos fallidos. Intenta de nuevo en unos minutos.",
  },
});

const router = Router();
const authController = new AuthController();

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.get("/me", authenticate, authController.getMe);

export default router;
