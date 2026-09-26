import express, { Application } from "express";
import cors from "cors";
import technicianRoutes from "./routes/technician.routes";

const app: Application = express();

app.use(cors());
app.use(express.json());

app.use("/api/technicians", technicianRoutes);

export default app;
