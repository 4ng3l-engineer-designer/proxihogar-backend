// src/routes/district.routes.ts
import { Router } from "express";
import { DistrictController } from "../controllers/district.controller";

const router = Router();
const districtController = new DistrictController();

router.get("/", districtController.getDistricts);

export default router;
