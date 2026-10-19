import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET no está definido en las variables de entorno.");
  process.exit(1);
}

import app from "./app";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor de ProxiHogar corriendo en http://localhost:${PORT}`);
});
