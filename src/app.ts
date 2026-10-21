// src/app.ts
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import technicianRoutes from "./routes/technician.routes";
import districtRoutes from "./routes/district.routes";
import requestRoutes from "./routes/request.routes";

const app: Application = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/technicians", technicianRoutes);
app.use("/api/districts", districtRoutes);
app.use("/api/requests", requestRoutes);

export default app;
