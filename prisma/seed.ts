// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SEED_EMAILS = [
  "juan.rios@correo.com",
  "carlos.mamani@correo.com",
  "miguel.soto@correo.com",
  "andres.chu@correo.com",
  "raul.huaman@correo.com",
  "pedro.quispe@correo.com",
  "walter.cardenas@correo.com",
  "luis.fernandez@correo.com",
];

const SEED_TECH_IDS = [
  "9837e9b0-0093-4ab1-9851-465a7031a941", // Juan Rios
  "4de52940-ebaa-4f57-8413-2c72f107e672", // Carlos Mamani
  "5c8c6f9a-eec8-4f9e-927b-ecfef0d88934", // Miguel Soto
  "447d5211-3e9e-4b20-9090-d0ab2393731e", // Andrés Chu
  "e44107d6-d6fd-487e-a93e-a237dd0947f5", // Raúl Huamán
  "7f352aec-1abb-464a-9f6e-8da58b3b24be", // Pedro Quispe
  "7bca293e-16d4-4881-8284-e7b7dda165e5", // Walter Cárdenas
  "0a14e85f-743f-48d7-b76f-b3d65e4b4819", // Luis Fernández
];

async function main() {
  // 1. Obtener los IDs de usuarios del seed actualmente registrados
  const seedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_EMAILS } },
    select: { id: true },
  });
  const seedUserIds = seedUsers.map((u) => u.id);

  // 2. Obtener los IDs de los técnicos asociados al seed
  const seedTechnicians = await prisma.technician.findMany({
    where: {
      OR: [
        { id: { in: SEED_TECH_IDS } },
        { userId: { in: seedUserIds } },
      ],
    },
    select: { id: true },
  });
  const allSeedTechIds = Array.from(new Set([...seedTechnicians.map((t) => t.id), ...SEED_TECH_IDS]));

  // 3. Borrar solo las reseñas de los técnicos del seed para reinsertarlas limpiamente
  await prisma.review.deleteMany({
    where: {
      technicianId: { in: allSeedTechIds },
    },
  });

  // 4. Borrar solo las solicitudes (Request) cuyo clientId sea un usuario del seed (NO borra las de clientes reales)
  if (seedUserIds.length > 0) {
    await prisma.request.deleteMany({
      where: {
        clientId: { in: seedUserIds },
      },
    });
  }

  const hashedPassword = await bcrypt.hash("password123", 10);

  // 5. Categorías (upsert para mantener la integridad)
  const catGas = await prisma.category.upsert({
    where: { slug: "gasfiteria" },
    update: {},
    create: {
      nombre: "Gasfitería",
      slug: "gasfiteria",
      icono: "🔧",
      color: "#2563EB",
      descripcion: "Instalación y reparación de tuberías, grifería, sanitarios y sistemas de agua.",
    },
  });

  const catElec = await prisma.category.upsert({
    where: { slug: "electricidad" },
    update: {},
    create: {
      nombre: "Electricidad",
      slug: "electricidad",
      icono: "⚡",
      color: "#7C3AED",
      descripcion: "Instalaciones eléctricas, reparación de cortocircuitos, tableros y cableado.",
    },
  });

  const catAlb = await prisma.category.upsert({
    where: { slug: "albanileria" },
    update: {},
    create: {
      nombre: "Albañilería",
      slug: "albanileria",
      icono: "🧱",
      color: "#059669",
      descripcion: "Construcción de muros, tarrajeo, enchapado, acabados y remodelaciones.",
    },
  });

  const catPint = await prisma.category.upsert({
    where: { slug: "pintura" },
    update: {},
    create: {
      nombre: "Pintura",
      slug: "pintura",
      icono: "🎨",
      color: "#DC2626",
      descripcion: "Pintado de interiores, exteriores, acabados decorativos y empastado.",
    },
  });

  // ── 1. Técnico Principal: Juan Rios (Electricista - Lurín) ──
  const user1 = await prisma.user.upsert({
    where: { email: "juan.rios@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Juan Rios",
      role: Role.WORKER,
      dniRuc: "45879632",
      telefono: "987654321",
    },
    create: {
      email: "juan.rios@correo.com",
      password: hashedPassword,
      nombre: "Juan Rios",
      role: Role.WORKER,
      dniRuc: "45879632",
      telefono: "987654321",
    },
  });

  const tech1Data = {
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
  };

  await prisma.technician.upsert({
    where: { id: "9837e9b0-0093-4ab1-9851-465a7031a941" },
    update: tech1Data,
    create: {
      id: "9837e9b0-0093-4ab1-9851-465a7031a941",
      ...tech1Data,
    },
  });

  await prisma.review.createMany({
    data: [
      {
        technicianId: "9837e9b0-0093-4ab1-9851-465a7031a941",
        autor: "María López",
        iniciales: "ML",
        calificacion: 5,
        comentario: "Excelente trabajo, muy puntual y dejó todo limpio. Resolvió el problema del tablero rápidamente.",
        tags: ["Puntual", "Calidad", "Limpieza"],
      },
      {
        technicianId: "9837e9b0-0093-4ab1-9851-465a7031a941",
        autor: "Carlos Mendoza",
        iniciales: "CM",
        calificacion: 5,
        comentario: "Muy profesional, explicó todo el proceso. Lo recomiendo al 100%.",
        tags: ["Amable", "Eficiente"],
      },
    ],
  });

  // ── 2. Gasfitero 1: Carlos Mamani (Villa El Salvador) ──
  const user2 = await prisma.user.upsert({
    where: { email: "carlos.mamani@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Carlos Mamani",
      role: Role.WORKER,
      dniRuc: "41982345",
      telefono: "912345678",
    },
    create: {
      email: "carlos.mamani@correo.com",
      password: hashedPassword,
      nombre: "Carlos Mamani",
      role: Role.WORKER,
      dniRuc: "41982345",
      telefono: "912345678",
    },
  });

  const tech2Data = {
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
  };

  await prisma.technician.upsert({
    where: { id: "4de52940-ebaa-4f57-8413-2c72f107e672" },
    update: tech2Data,
    create: {
      id: "4de52940-ebaa-4f57-8413-2c72f107e672",
      ...tech2Data,
    },
  });

  await prisma.review.createMany({
    data: [
      {
        technicianId: "4de52940-ebaa-4f57-8413-2c72f107e672",
        autor: "Roberto Silva",
        iniciales: "RS",
        calificacion: 5,
        comentario: "Solucionó la fuga de agua en menos de una hora. Muy recomendado.",
        tags: ["Rápido", "Eficaz"],
      },
      {
        technicianId: "4de52940-ebaa-4f57-8413-2c72f107e672",
        autor: "Patricia Flores",
        iniciales: "PF",
        calificacion: 4,
        comentario: "Buen trabajo en el desatoro del baño, puntual y ordenado.",
        tags: ["Puntual", "Ordenado"],
      },
    ],
  });

  // ── 3. Gasfitero 2: Miguel Soto (Villa María del Triunfo) - verificado: false ──
  const user3 = await prisma.user.upsert({
    where: { email: "miguel.soto@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Miguel Soto",
      role: Role.WORKER,
      dniRuc: "71239841",
      telefono: "923456789",
    },
    create: {
      email: "miguel.soto@correo.com",
      password: hashedPassword,
      nombre: "Miguel Soto",
      role: Role.WORKER,
      dniRuc: "71239841",
      telefono: "923456789",
    },
  });

  const tech3Data = {
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
  };

  await prisma.technician.upsert({
    where: { id: "5c8c6f9a-eec8-4f9e-927b-ecfef0d88934" },
    update: tech3Data,
    create: {
      id: "5c8c6f9a-eec8-4f9e-927b-ecfef0d88934",
      ...tech3Data,
    },
  });

  // ── 4. Electricista 2: Andrés Chu (Santiago de Surco) ──
  const user4 = await prisma.user.upsert({
    where: { email: "andres.chu@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Andrés Chu",
      role: Role.WORKER,
      dniRuc: "10748293",
      telefono: "934567890",
    },
    create: {
      email: "andres.chu@correo.com",
      password: hashedPassword,
      nombre: "Andrés Chu",
      role: Role.WORKER,
      dniRuc: "10748293",
      telefono: "934567890",
    },
  });

  const tech4Data = {
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
  };

  await prisma.technician.upsert({
    where: { id: "447d5211-3e9e-4b20-9090-d0ab2393731e" },
    update: tech4Data,
    create: {
      id: "447d5211-3e9e-4b20-9090-d0ab2393731e",
      ...tech4Data,
    },
  });

  await prisma.review.createMany({
    data: [
      {
        technicianId: "447d5211-3e9e-4b20-9090-d0ab2393731e",
        autor: "Jorge Alva",
        iniciales: "JA",
        calificacion: 5,
        comentario: "Instaló el pozo a tierra y me entregó el protocolo firmado sin demoras.",
        tags: ["Profesional", "Garantía"],
      },
    ],
  });

  // ── 5. Electricista 3: Raúl Huamán (Lurín) - verificado: false - tarifaBase: null ──
  const user5 = await prisma.user.upsert({
    where: { email: "raul.huaman@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Raúl Huamán",
      role: Role.WORKER,
      dniRuc: "46891230",
      telefono: "945678901",
    },
    create: {
      email: "raul.huaman@correo.com",
      password: hashedPassword,
      nombre: "Raúl Huamán",
      role: Role.WORKER,
      dniRuc: "46891230",
      telefono: "945678901",
    },
  });

  const tech5Data = {
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
    tarifaBase: null,
    ubicacion: "Lurín, Lima",
    latitude: -12.2800,
    longitude: -76.8650,
    disponible: true,
    experienciaAnios: 3,
    categoriaId: catElec.id,
  };

  await prisma.technician.upsert({
    where: { id: "e44107d6-d6fd-487e-a93e-a237dd0947f5" },
    update: tech5Data,
    create: {
      id: "e44107d6-d6fd-487e-a93e-a237dd0947f5",
      ...tech5Data,
    },
  });

  // ── 6. Albañil 1: Pedro Quispe (Pachacámac) ──
  const user6 = await prisma.user.upsert({
    where: { email: "pedro.quispe@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Pedro Quispe",
      role: Role.WORKER,
      dniRuc: "09456781",
      telefono: "956789012",
    },
    create: {
      email: "pedro.quispe@correo.com",
      password: hashedPassword,
      nombre: "Pedro Quispe",
      role: Role.WORKER,
      dniRuc: "09456781",
      telefono: "956789012",
    },
  });

  const tech6Data = {
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
  };

  await prisma.technician.upsert({
    where: { id: "7f352aec-1abb-464a-9f6e-8da58b3b24be" },
    update: tech6Data,
    create: {
      id: "7f352aec-1abb-464a-9f6e-8da58b3b24be",
      ...tech6Data,
    },
  });

  await prisma.review.createMany({
    data: [
      {
        technicianId: "7f352aec-1abb-464a-9f6e-8da58b3b24be",
        autor: "Lucía Paz",
        iniciales: "LP",
        calificacion: 5,
        comentario: "Excelente acabado en los cerámicos del baño y cocina. Muy detallista.",
        tags: ["Detallista", "Puntual"],
      },
    ],
  });

  // ── 7. Albañil 2: Walter Cárdenas (San Juan de Miraflores) - disponible: false ──
  const user7 = await prisma.user.upsert({
    where: { email: "walter.cardenas@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Walter Cárdenas",
      role: Role.WORKER,
      dniRuc: "42109876",
      telefono: "967890123",
    },
    create: {
      email: "walter.cardenas@correo.com",
      password: hashedPassword,
      nombre: "Walter Cárdenas",
      role: Role.WORKER,
      dniRuc: "42109876",
      telefono: "967890123",
    },
  });

  const tech7Data = {
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
  };

  await prisma.technician.upsert({
    where: { id: "7bca293e-16d4-4881-8284-e7b7dda165e5" },
    update: tech7Data,
    create: {
      id: "7bca293e-16d4-4881-8284-e7b7dda165e5",
      ...tech7Data,
    },
  });

  // ── 8. Pintor 1: Luis Fernández (Miraflores) ──
  const user8 = await prisma.user.upsert({
    where: { email: "luis.fernandez@correo.com" },
    update: {
      password: hashedPassword,
      nombre: "Luis Fernández",
      role: Role.WORKER,
      dniRuc: "43761298",
      telefono: "978901234",
    },
    create: {
      email: "luis.fernandez@correo.com",
      password: hashedPassword,
      nombre: "Luis Fernández",
      role: Role.WORKER,
      dniRuc: "43761298",
      telefono: "978901234",
    },
  });

  const tech8Data = {
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
  };

  await prisma.technician.upsert({
    where: { id: "0a14e85f-743f-48d7-b76f-b3d65e4b4819" },
    update: tech8Data,
    create: {
      id: "0a14e85f-743f-48d7-b76f-b3d65e4b4819",
      ...tech8Data,
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
