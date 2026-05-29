import http from "node:http";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { createSocketServer } from "./socket/index.js";
import { startDeviceWatchdog } from "./services/watchdog.js";
import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patients.js";
import { telemetryRoutes } from "./routes/telemetry.js";
import alertRoutes from "./routes/alerts.js";
import deviceRoutes from "./routes/devices.js";
import analyticsRoutes from "./routes/analytics.js";
import reportRoutes from "./routes/reports.js";

const app = express();
const server = http.createServer(app);
const io = createSocketServer(server);

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true, name: "DripSense AI API" }));
app.use("/api/auth", authRoutes);
app.use("/api/telemetry", telemetryRoutes(io));
app.use("/api/patients", requireAuth, patientRoutes);
app.use("/api/alerts", requireAuth, alertRoutes);
app.use("/api/devices", requireAuth, deviceRoutes);
app.use("/api/analytics", requireAuth, analyticsRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

startDeviceWatchdog(io);

server.listen(env.SERVER_PORT, () => {
  logger.info("server.started", { port: env.SERVER_PORT });
});
