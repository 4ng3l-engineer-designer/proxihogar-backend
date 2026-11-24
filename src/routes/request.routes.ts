// src/routes/request.routes.ts
import { Router } from "express";
import { Role } from "@prisma/client";
import { RequestController } from "../controllers/request.controller";
import { WorkOrderController } from "../controllers/workOrder.controller";
import { ReviewController } from "../controllers/review.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";
import { uploadChatAudio, uploadChatImage, uploadChatVideo } from "../middlewares/upload.middleware";

const router = Router();
const requestController = new RequestController();
const workOrderController = new WorkOrderController();
const reviewController = new ReviewController();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas exclusivas para CLIENT
router.post("/", requireRole(Role.CLIENT), requestController.create);
router.get("/", requireRole(Role.CLIENT), requestController.getAll);

// Acceso al chat (disponible para CLIENT dueño y WORKER asignado)
router.get("/:id/chat", requestController.getChatAccess);

// Mensajes del chat (disponible para CLIENT dueño y WORKER asignado)
router.get("/:id/messages", requestController.getMessages);
router.patch("/:id/messages/read", requestController.markMessagesAsRead);
router.post("/:id/messages/image", uploadChatImage, requestController.createImageMessage);
router.post("/:id/messages/audio", uploadChatAudio, requestController.createAudioMessage);
router.post("/:id/messages/video", uploadChatVideo, requestController.createVideoMessage);
router.post("/:id/messages", requestController.createMessage);

// Orden de trabajo y pago (C56)
router.post("/:id/work-order", requireRole(Role.WORKER), workOrderController.create);
router.patch("/:id/work-order/send", requireRole(Role.WORKER), workOrderController.send);
router.get("/:id/work-order", workOrderController.getByRequestId);
router.post("/:id/work-order/pay", requireRole(Role.CLIENT), workOrderController.pay);

// Reseña post-servicio (C52/C57)
router.post("/:id/review", requireRole(Role.CLIENT), reviewController.createForRequest);
router.get("/:id/review", reviewController.getForRequest);

// Ruta en tiempo real hacia el domicilio (solo CLIENT dueño; otros reciben 404)
router.get("/:id/route", requestController.getRoute);

// Detalle de solicitud (CLIENT)
router.get("/:id", requireRole(Role.CLIENT), requestController.getById);

// Actualizar estado (disponible tanto para CLIENT dueño como para WORKER asignado)
router.patch("/:id/status", requestController.updateStatus);

export default router;
