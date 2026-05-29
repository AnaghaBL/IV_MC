import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { env } from "../config/env.js";

export const createSocketServer = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true }
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:ward", (wardId: string) => socket.join(`ward:${wardId}`));
    socket.on("subscribe:patient", (patientId: string) => socket.join(`patient:${patientId}`));
    socket.on("alert:acknowledge", (alertId: string) => socket.emit("alert:acknowledged", { alertId }));
  });

  return io;
};

export type AppSocketServer = ReturnType<typeof createSocketServer>;
