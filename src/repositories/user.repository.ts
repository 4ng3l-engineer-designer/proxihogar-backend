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
}
