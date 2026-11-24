// src/middlewares/upload.middleware.ts
import { Request, Response, NextFunction } from "express";
import multer from "multer";

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_SIZE_BYTES,
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_VIDEO_SIZE_BYTES,
  },
});

export const uploadChatImage = (req: Request, res: Response, next: NextFunction): void => {
  imageUpload.single("imagen")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: "La imagen supera el tamaño máximo permitido de 5 MB.",
        });
        return;
      }

      res.status(400).json({
        error: "Error al procesar el archivo adjunto en el campo 'imagen'.",
      });
      return;
    }

    res.status(400).json({
      error: "Solicitud multipart/form-data inválida.",
    });
  });
};

export const uploadChatAudio = (req: Request, res: Response, next: NextFunction): void => {
  audioUpload.single("audio")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: "El audio no puede superar los 10 MB.",
        });
        return;
      }

      res.status(400).json({
        error: "Error al procesar el archivo adjunto en el campo 'audio'.",
      });
      return;
    }

    res.status(400).json({
      error: "Solicitud multipart/form-data inválida.",
    });
  });
};

export const uploadChatVideo = (req: Request, res: Response, next: NextFunction): void => {
  videoUpload.single("video")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: "El video no puede superar los 50 MB.",
        });
        return;
      }

      res.status(400).json({
        error: "Error al procesar el archivo adjunto en el campo 'video'.",
      });
      return;
    }

    res.status(400).json({
      error: "Solicitud multipart/form-data inválida.",
    });
  });
};

