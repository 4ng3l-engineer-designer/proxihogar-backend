// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { HttpError } from "../utils/errors";

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, nombre, telefono, role } = req.body;
      const result = await this.authService.register({
        email,
        password,
        nombre,
        telefono,
        role,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error en registro de usuario:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login({ email, password });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error en inicio de sesión:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };

  getMe = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: "No autenticado." });
        return;
      }

      const userProfile = await this.authService.getProfile(req.user.id);
      res.status(200).json(userProfile);
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Error al obtener perfil del usuario autenticado:", error);
      res.status(500).json({
        error: "Ocurrió un error interno al procesar la solicitud.",
      });
    }
  };
}
