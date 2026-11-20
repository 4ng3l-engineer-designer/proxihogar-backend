// src/repositories/user.repository.ts
import { prisma } from "../utils/prisma";
import { Role, User } from "@prisma/client";
import { UserProfileResponse } from "../types/auth.types";

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findProfileById(id: string): Promise<UserProfileResponse | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        dniRuc: true,
        telefono: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: {
    email: string;
    password: string;
    nombre: string;
    role: Role;
    telefono?: string;
  }): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async updateProfile(
    id: string,
    data: { nombre: string; telefono?: string | null }
  ): Promise<UserProfileResponse> {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        nombre: true,
        role: true,
        dniRuc: true,
        telefono: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async createWorkerWithTechnician(data: {
    email: string;
    password: string;
    nombre: string;
    telefono?: string;
    iniciales: string;
  }): Promise<User> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: data.password,
          nombre: data.nombre,
          role: Role.WORKER,
          telefono: data.telefono,
        },
      });

      await tx.technician.create({
        data: {
          userId: user.id,
          nombre: data.nombre,
          iniciales: data.iniciales,
          colorAvatar: "#0B192C",
          especialidad: "Sin especificar",
          especialidades: [],
          descripcion: "",
          tarifaBase: null,
          ubicacion: "Lima, Perú",
          latitude: -12.0464,
          longitude: -77.0428,
          experienciaAnios: 0,
          disponible: false,
          verificado: false,
        },
      });

      return user;
    });
  }
}
