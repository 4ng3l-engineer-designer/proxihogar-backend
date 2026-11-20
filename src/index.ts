import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET no está definido en las variables de entorno.");
  process.exit(1);
}

import http from "http";
import app from "./app";
import { initSocketServer } from "./realtime/socket";
import { getRequestExpiryHours, startExpireRequestsJob } from "./jobs/expireRequests";

let requestExpiryHours: number;
try {
  requestExpiryHours = getRequestExpiryHours();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Servidor de ProxiHogar corriendo en http://localhost:${PORT}`);
  startExpireRequestsJob(requestExpiryHours);
});

export { server };
