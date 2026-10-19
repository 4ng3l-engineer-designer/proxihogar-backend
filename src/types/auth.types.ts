// src/types/auth.types.ts
import { Role } from "@prisma/client";

export interface RegisterDto {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  role?: "CLIENT" | "WORKER";
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  nombre: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: AuthUserResponse;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  nombre: string;
  role: Role;
  dniRuc?: string | null;
  telefono?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  sub: string;
  role: Role;
}
