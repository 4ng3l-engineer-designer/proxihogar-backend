// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { JwtPayload } from "../types/auth.types";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Token de autenticación no proporcionado o formato inválido.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      error: "Configuración de autenticación no disponible en el servidor.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (!decoded || !decoded.sub || !decoded.role) {
      res.status(401).json({
        error: "Token inválido o malformado.",
      });
      return;
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: "Token inválido o expirado.",
    });
    return;
  }
};

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "No autenticado.",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Acceso denegado: permisos insuficientes.",
      });
      return;
    }

    next();
  };
};
