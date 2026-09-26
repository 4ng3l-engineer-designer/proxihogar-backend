// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  await prisma.review.deleteMany();
  await prisma.request.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.service.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Categorías
  const catGas = await prisma.category.create({
    data: {
      nombre: "Gasfitería",
      slug: "gasfiteria",
      icono: "🔧",
      color: "#2563EB",
      descripcion: "Instalación y reparación de tuberías, grifería, sanitarios y sistemas de agua.",
    },
  });

  const catElec = await prisma.category.create({
    data: {
      nombre: "Electricidad",
      slug: "electricidad",
      icono: "⚡",
      color: "#7C3AED",
      descripcion: "Instalaciones eléctricas, reparación de cortocircuitos, tableros y cableado.",
    },
  });

  // 2. Usuario y Perfil Técnico (Juan Rios - Lurín)
  const user1 = await prisma.user.create({
    data: {
      email: "juan.rios@correo.com",
      password: hashedPassword,
      nombre: "Juan Rios",
      role: Role.WORKER,
      dniRuc: "45879632",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user1.id,
      nombre: "Juan Rios",
      iniciales: "JR",
      colorAvatar: "#0B192C",
      especialidad: "Electricista",
      especialidades: [
        "Instalación eléctrica",
        "Reparación de cortocircuitos",
        "Cambio de tablero eléctrico",
        "Instalación de luminarias",
      ],
      descripcion: "Técnico electricista con más de 8 años de experiencia en instalaciones residenciales y comerciales. Certificado por SENATI. Trabajo limpio y puntual.",
      verificado: true,
      calificacion: 4.9,
      cantidadResenas: 142,
      cantidadTrabajos: 248,
      tarifaBase: 30,
      ubicacion: "Lurín, Lima",
      latitude: -12.2745,
      longitude: -76.8711,
      disponible: true,
      experienciaAnios: 8,
      categoriaId: catElec.id,
      resenas: {
        create: [
          {
            autor: "María López",
            iniciales: "ML",
            calificacion: 5,
            comentario: "Excelente trabajo, muy puntual y dejó todo limpio. Resolvió el problema del tablero rápidamente.",
            tags: ["Puntual", "Calidad", "Limpieza"],
          },
          {
            autor: "Carlos Mendoza",
            iniciales: "CM",
            calificacion: 5,
            comentario: "Muy profesional, explicó todo el proceso. Lo recomiendo al 100%.",
            tags: ["Amable", "Eficiente"],
          },
        ],
      },
    },
  });

  console.log("Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
