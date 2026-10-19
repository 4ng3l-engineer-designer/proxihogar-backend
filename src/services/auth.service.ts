// src/services/auth.service.ts
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { UserRepository } from "../repositories/user.repository";
import {
  AuthResponse,
  LoginDto,
  RegisterDto,
  UserProfileResponse,
} from "../types/auth.types";
import { HttpError } from "../utils/errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;

export class AuthService {
  constructor(private readonly userRepository = new UserRepository()) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // 1. Validar nombre no vacío
    if (!dto.nombre || typeof dto.nombre !== "string" || dto.nombre.trim() === "") {
      throw new HttpError(400, "El nombre es obligatorio y no puede estar vacío.");
    }

    // 2. Validar formato de email
    if (!dto.email || typeof dto.email !== "string" || !EMAIL_REGEX.test(dto.email.trim())) {
      throw new HttpError(400, "Formato de email inválido.");
    }

    // 3. Validar longitud mínima de contraseña (8 caracteres)
    if (!dto.password || typeof dto.password !== "string" || dto.password.length < 8) {
      throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.");
    }

    // 4. Validar rol: solo "CLIENT" o "WORKER", por defecto "CLIENT"
    let assignedRole: Role = Role.CLIENT;
    if (dto.role !== undefined && dto.role !== null) {
      if (dto.role !== "CLIENT" && dto.role !== "WORKER") {
        throw new HttpError(400, "El rol debe ser 'CLIENT' o 'WORKER'.");
      }
      assignedRole = dto.role === "WORKER" ? Role.WORKER : Role.CLIENT;
    }

    // 5. Normalizar email a minúsculas y sin espacios
    const normalizedEmail = dto.email.trim().toLowerCase();

    // 6. Verificar si el email ya existe (409)
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new HttpError(409, "El correo electrónico ya se encuentra registrado.");
    }

    // 7. Hashear contraseña con bcrypt (10 rondas)
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // 8. Crear usuario en la base de datos
    const user = await this.userRepository.create({
      email: normalizedEmail,
      password: hashedPassword,
      nombre: dto.nombre.trim(),
      role: assignedRole,
      telefono: dto.telefono ? dto.telefono.trim() : undefined,
    });

    // 9. Generar JWT
    const token = this.generateToken(user.id, user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    if (!dto.email || !dto.password) {
      throw new HttpError(401, "Credenciales inválidas");
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new HttpError(401, "Credenciales inválidas");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new HttpError(401, "Credenciales inválidas");
    }

    const token = this.generateToken(user.id, user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const profile = await this.userRepository.findProfileById(userId);
    if (!profile) {
      throw new HttpError(404, "Usuario no encontrado.");
    }
    return profile;
  }

  private generateToken(userId: string, role: Role): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET no configurado.");
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

    return jwt.sign(
      {
        sub: userId,
        role,
      },
      secret,
      {
        expiresIn,
      }
    );
  }
}
