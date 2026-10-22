// src/routes/requestStatus.routes.ts
import { Router, Request, Response } from "express";
import { getAllStatusList } from "../utils/requestStatus";

const router = Router();

// GET /api/request-statuses (pública)
router.get("/", (_req: Request, res: Response) => {
  res.status(200).json(getAllStatusList());
});

export default router;
