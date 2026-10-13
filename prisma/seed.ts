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

  const catAlb = await prisma.category.create({
    data: {
      nombre: "Albañilería",
      slug: "albanileria",
      icono: "🧱",
      color: "#059669",
      descripcion: "Construcción de muros, tarrajeo, enchapado, acabados y remodelaciones.",
    },
  });

  const catPint = await prisma.category.create({
    data: {
      nombre: "Pintura",
      slug: "pintura",
      icono: "🎨",
      color: "#DC2626",
      descripcion: "Pintado de interiores, exteriores, acabados decorativos y empastado.",
    },
  });

  // 2. Técnico Principal (Juan Rios - Lurín) - ID explícito y conservado
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
      id: "9837e9b0-0093-4ab1-9851-465a7031a941",
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

  // 3. Gasfitero 1 (Carlos Mamani - Villa El Salvador)
  const user2 = await prisma.user.create({
    data: {
      email: "carlos.mamani@correo.com",
      password: hashedPassword,
      nombre: "Carlos Mamani",
      role: Role.WORKER,
      dniRuc: "41982345",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user2.id,
      nombre: "Carlos Mamani",
      iniciales: "CM",
      colorAvatar: "#1E3A8A",
      especialidad: "Gasfitero",
      especialidades: [
        "Reparación de tuberías",
        "Desatoro de desagües",
        "Instalación de grifería",
        "Detección de fugas",
      ],
      descripcion: "Especialista en desatoros y detección de fugas ocultas. Atención rápida para emergencias domésticas.",
      verificado: true,
      calificacion: 4.8,
      cantidadResenas: 98,
      cantidadTrabajos: 156,
      tarifaBase: 35,
      ubicacion: "Villa El Salvador, Lima",
      latitude: -12.2136,
      longitude: -76.9319,
      disponible: true,
      experienciaAnios: 12,
      categoriaId: catGas.id,
      resenas: {
        create: [
          {
            autor: "Roberto Silva",
            iniciales: "RS",
            calificacion: 5,
            comentario: "Solucionó la fuga de agua en menos de una hora. Muy recomendado.",
            tags: ["Rápido", "Eficaz"],
          },
          {
            autor: "Patricia Flores",
            iniciales: "PF",
            calificacion: 4,
            comentario: "Buen trabajo en el desatoro del baño, puntual y ordenado.",
            tags: ["Puntual", "Ordenado"],
          },
        ],
      },
    },
  });

  // 4. Gasfitero 2 (Miguel Soto - Villa María del Triunfo) - verificado: false
  const user3 = await prisma.user.create({
    data: {
      email: "miguel.soto@correo.com",
      password: hashedPassword,
      nombre: "Miguel Soto",
      role: Role.WORKER,
      dniRuc: "71239841",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user3.id,
      nombre: "Miguel Soto",
      iniciales: "MS",
      colorAvatar: "#0D9488",
      especialidad: "Gasfitero",
      especialidades: [
        "Instalación de bombas de agua",
        "Mantenimiento de termas",
        "Gasfitería general",
      ],
      descripcion: "Técnico con experiencia en mantenimiento de termas eléctricas y bombas de agua residenciales.",
      verificado: false,
      calificacion: 4.2,
      cantidadResenas: 18,
      cantidadTrabajos: 34,
      tarifaBase: 25,
      ubicacion: "Villa María del Triunfo, Lima",
      latitude: -12.1606,
      longitude: -76.9386,
      disponible: true,
      experienciaAnios: 4,
      categoriaId: catGas.id,
    },
  });

  // 5. Electricista 2 (Andrés Chu - Santiago de Surco)
  const user4 = await prisma.user.create({
    data: {
      email: "andres.chu@correo.com",
      password: hashedPassword,
      nombre: "Andrés Chu",
      role: Role.WORKER,
      dniRuc: "10748293",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user4.id,
      nombre: "Andrés Chu",
      iniciales: "AC",
      colorAvatar: "#4C1D95",
      especialidad: "Electricista",
      especialidades: [
        "Instalaciones trifásicas",
        "Pozo a tierra",
        "Certificación eléctrica",
        "Mantenimiento de tableros",
      ],
      descripcion: "Electricista industrial y residencial colegiado. Elaboración de expedientes y medición de pozo a tierra.",
      verificado: true,
      calificacion: 4.9,
      cantidadResenas: 45,
      cantidadTrabajos: 82,
      tarifaBase: 80,
      ubicacion: "Santiago de Surco, Lima",
      latitude: -12.1453,
      longitude: -77.0010,
      disponible: true,
      experienciaAnios: 14,
      categoriaId: catElec.id,
      resenas: {
        create: [
          {
            autor: "Jorge Alva",
            iniciales: "JA",
            calificacion: 5,
            comentario: "Instaló el pozo a tierra y me entregó el protocolo firmado sin demoras.",
            tags: ["Profesional", "Garantía"],
          },
        ],
      },
    },
  });

  // 6. Electricista 3 (Raúl Huamán - Lurín) - verificado: false
  const user5 = await prisma.user.create({
    data: {
      email: "raul.huaman@correo.com",
      password: hashedPassword,
      nombre: "Raúl Huamán",
      role: Role.WORKER,
      dniRuc: "46891230",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user5.id,
      nombre: "Raúl Huamán",
      iniciales: "RH",
      colorAvatar: "#B45309",
      especialidad: "Electricista",
      especialidades: [
        "Cableado estructurado",
        "Reparación de cortocircuitos",
        "Iluminación LED",
      ],
      descripcion: "Técnico en reparaciones eléctricas rápidas para casas y condominios en la zona sur.",
      verificado: false,
      calificacion: 3.8,
      cantidadResenas: 12,
      cantidadTrabajos: 22,
      tarifaBase: 30,
      ubicacion: "Lurín, Lima",
      latitude: -12.2800,
      longitude: -76.8650,
      disponible: true,
      experienciaAnios: 3,
      categoriaId: catElec.id,
    },
  });

  // 7. Albañil 1 (Pedro Quispe - Pachacámac)
  const user6 = await prisma.user.create({
    data: {
      email: "pedro.quispe@correo.com",
      password: hashedPassword,
      nombre: "Pedro Quispe",
      role: Role.WORKER,
      dniRuc: "09456781",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user6.id,
      nombre: "Pedro Quispe",
      iniciales: "PQ",
      colorAvatar: "#065F46",
      especialidad: "Albañil",
      especialidades: [
        "Tarrajeo",
        "Enchapado de cerámicos",
        "Asentado de ladrillos",
        "Remodelación de baños",
      ],
      descripcion: "Maestro albañil con equipo completo. Trabajos de acabados finos y pequeñas ampliaciones.",
      verificado: true,
      calificacion: 4.7,
      cantidadResenas: 65,
      cantidadTrabajos: 110,
      tarifaBase: 50,
      ubicacion: "Pachacámac, Lima",
      latitude: -12.2297,
      longitude: -76.8567,
      disponible: true,
      experienciaAnios: 15,
      categoriaId: catAlb.id,
      resenas: {
        create: [
          {
            autor: "Lucía Paz",
            iniciales: "LP",
            calificacion: 5,
            comentario: "Excelente acabado en los cerámicos del baño y cocina. Muy detallista.",
            tags: ["Detallista", "Puntual"],
          },
        ],
      },
    },
  });

  // 8. Albañil 2 (Walter Cárdenas - San Juan de Miraflores) - disponible: false
  const user7 = await prisma.user.create({
    data: {
      email: "walter.cardenas@correo.com",
      password: hashedPassword,
      nombre: "Walter Cárdenas",
      role: Role.WORKER,
      dniRuc: "42109876",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user7.id,
      nombre: "Walter Cárdenas",
      iniciales: "WC",
      colorAvatar: "#991B1B",
      especialidad: "Albañil",
      especialidades: [
        "Muros y divisiones",
        "Vaciado de pisos",
        "Reparación de rajaduras",
      ],
      descripcion: "Construcción y albañilería general para viviendas unifamiliares. Presupuestos sin compromiso.",
      verificado: true,
      calificacion: 4.4,
      cantidadResenas: 31,
      cantidadTrabajos: 58,
      tarifaBase: 45,
      ubicacion: "San Juan de Miraflores, Lima",
      latitude: -12.1550,
      longitude: -76.9700,
      disponible: false,
      experienciaAnios: 9,
      categoriaId: catAlb.id,
    },
  });

  // 9. Pintor 1 (Luis Fernández - Miraflores)
  const user8 = await prisma.user.create({
    data: {
      email: "luis.fernandez@correo.com",
      password: hashedPassword,
      nombre: "Luis Fernández",
      role: Role.WORKER,
      dniRuc: "43761298",
    },
  });

  await prisma.technician.create({
    data: {
      userId: user8.id,
      nombre: "Luis Fernández",
      iniciales: "LF",
      colorAvatar: "#C2410C",
      especialidad: "Pintor",
      especialidades: [
        "Pintura latex",
        "Empastado de paredes",
        "Estucado",
        "Pintura de fachadas",
      ],
      descripcion: "Pintor profesional de interiores y exteriores. Acabados lisos, protección de pisos y muebles garantizada.",
      verificado: true,
      calificacion: 4.6,
      cantidadResenas: 52,
      cantidadTrabajos: 95,
      tarifaBase: 40,
      ubicacion: "Miraflores, Lima",
      latitude: -12.1219,
      longitude: -77.0297,
      disponible: true,
      experienciaAnios: 7,
      categoriaId: catPint.id,
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
