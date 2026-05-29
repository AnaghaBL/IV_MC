import http from "node:http";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { env } from "./config/env.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.CLIENT_ORIGIN, credentials: true }
});

app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

const staff = {
  id: "30000000-0000-4000-8000-000000000001",
  hospitalId: "00000000-0000-4000-8000-000000000001",
  email: "admin@dripsense.local",
  name: "Avery Shah",
  role: "ADMIN"
};

const configuredEsp32CamIp = process.env.ESP32_CAM_IP;
const maincodePath = resolve(process.cwd(), "../../maincode.py");
const maincodeEsp32CamIp = (() => {
  try {
    const match = readFileSync(maincodePath, "utf8").match(/url\s*=\s*["']http:\/\/([^/"']+)\/stream["']/);
    return match?.[1];
  } catch {
    return undefined;
  }
})();
const esp32CamIp = configuredEsp32CamIp ?? maincodeEsp32CamIp ?? "10.173.4.185";
const esp32CamUrl = `http://${esp32CamIp}`;
const esp32StatsMode = process.env.ESP32_STATS_MODE ?? "on";
const openCvBridgeMode = process.env.OPENCV_BRIDGE ?? "off";
let lastEsp32Drops: number | null = null;
let lastEsp32PollAt: number | null = null;
let lastEsp32DropAt: number | null = null;
let lastPrimaryTelemetryAt = 0;
let primaryMockTick = 0;

interface MockPatient {
  id: string;
  name: string;
  mrn: string;
  diagnosis: string;
  room_number: string;
  bed_number: string;
  ward_id: string;
  ward_name: string;
  session_id: string | null;
  fluid_type: string;
  volume_ml: number;
  rate_ml_hr: number;
  dpm: number;
  flow_rate_ml_hr: number;
  bubble_alarm: boolean;
  is_online: boolean;
  wifi_rssi: number;
  battery_level: number;
  ip_address: string;
  risk_score: number;
  last_telemetry_at: string;
}

interface MockDevice {
  id: string;
  device_type: string;
  mac_address: string;
  firmware_version: string;
  ip_address: string;
  wifi_rssi: number;
  battery_level: number;
  last_seen: string;
  is_online: boolean;
  bed_number: string;
  room_number: string;
  ward_name: string;
}

interface MockTelemetry {
  timestamp: string;
  dpm: number;
  flow_rate_ml_hr: number;
  alarm_active: boolean;
  session_id?: string | null;
  device_id?: string;
  raw_sensor?: number;
  baseline_sensor?: number;
}

interface MockAlert {
  id: string;
  patient_id: string;
  device_id: string;
  session_id: string | null;
  type: string;
  severity: string;
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
  escalation_level: number;
  is_resolved: boolean;
  patient_name: string;
  room_number: string;
  bed_number: string;
}

const patients: MockPatient[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    name: "Elena Brooks",
    mrn: "MRN-240001",
    diagnosis: "Sepsis observation",
    room_number: "ICU-01",
    bed_number: "B1",
    ward_id: "10000000-0000-4000-8000-000000000001",
    ward_name: "ICU",
    session_id: "60000000-0000-4000-8000-000000000001",
    fluid_type: "Normal Saline 0.9%",
    volume_ml: 1000,
    rate_ml_hr: 95,
    dpm: 63,
    flow_rate_ml_hr: 96,
    bubble_alarm: true,
    is_online: true,
    wifi_rssi: -52,
    battery_level: 88,
    ip_address: "localhost:4000",
    risk_score: 100,
    last_telemetry_at: new Date().toISOString()
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    name: "Marcus Chen",
    mrn: "MRN-240002",
    diagnosis: "Post-op monitoring",
    room_number: "ICU-02",
    bed_number: "B2",
    ward_id: "10000000-0000-4000-8000-000000000001",
    ward_name: "ICU",
    session_id: "60000000-0000-4000-8000-000000000002",
    fluid_type: "Ringer's Lactate",
    volume_ml: 500,
    rate_ml_hr: 80,
    dpm: 41,
    flow_rate_ml_hr: 62,
    bubble_alarm: false,
    is_online: true,
    wifi_rssi: -61,
    battery_level: 72,
    ip_address: "10.19.187.187",
    risk_score: 60,
    last_telemetry_at: new Date(Date.now() - 12_000).toISOString()
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    name: "Samira Khan",
    mrn: "MRN-240003",
    diagnosis: "Pneumonia",
    room_number: "ICU-03",
    bed_number: "B3",
    ward_id: "10000000-0000-4000-8000-000000000001",
    ward_name: "ICU",
    session_id: "60000000-0000-4000-8000-000000000003",
    fluid_type: "D5W",
    volume_ml: 1000,
    rate_ml_hr: 110,
    dpm: 0,
    flow_rate_ml_hr: 0,
    bubble_alarm: false,
    is_online: false,
    wifi_rssi: -73,
    battery_level: 45,
    ip_address: "10.19.187.189",
    risk_score: 20,
    last_telemetry_at: new Date(Date.now() - 90_000).toISOString()
  },
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(index + 4).padStart(12, "0")}`,
    name: ["Grace Patel", "Owen Miller", "Mina Alvarez", "Theo Brown", "Iris Novak", "Dev Singh", "Hana Ito", "Robert Ellis", "Noah Williams"][index] ?? "Patient",
    mrn: `MRN-2400${index + 4}`.padEnd(10, "0"),
    diagnosis: "Infusion monitoring",
    room_number: index < 4 ? `S-0${index + 4}` : `G-0${index + 4}`,
    bed_number: `B${index + 4}`,
    ward_id: index < 4 ? "10000000-0000-4000-8000-000000000002" : "10000000-0000-4000-8000-000000000003",
    ward_name: index < 4 ? "Surgical" : "General",
    session_id: index < 2 ? `60000000-0000-4000-8000-${String(index + 4).padStart(12, "0")}` : null,
    fluid_type: ["Vancomycin 500mg", "Heparin 5000U", "Normal Saline 0.9%"][index % 3] ?? "Normal Saline 0.9%",
    volume_ml: 500,
    rate_ml_hr: 75,
    dpm: 48 + index * 3,
    flow_rate_ml_hr: 72 + index * 4,
    bubble_alarm: false,
    is_online: index !== 7,
    wifi_rssi: -50 - index,
    battery_level: 90 - index * 4,
    ip_address: index === 0 && esp32CamIp ? esp32CamIp : `10.19.187.${190 + index}`,
    risk_score: index === 6 ? 55 : 10 + index * 3,
    last_telemetry_at: new Date(Date.now() - index * 15_000).toISOString()
  }))
];

let alerts: MockAlert[] = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    patient_id: patients[0]?.id ?? "",
    device_id: "50000000-0000-4000-8000-000000000002",
    session_id: patients[0]?.session_id ?? null,
    type: "AIR_BUBBLE",
    severity: "CRITICAL",
    message: "Air bubble detected by IR sensor",
    triggered_at: new Date(Date.now() - 180_000).toISOString(),
    acknowledged_at: null,
    escalation_level: 1,
    is_resolved: false,
    patient_name: patients[0]?.name ?? "",
    room_number: patients[0]?.room_number ?? "",
    bed_number: patients[0]?.bed_number ?? ""
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    patient_id: patients[1]?.id ?? "",
    device_id: "50000000-0000-4000-8000-000000000003",
    session_id: patients[1]?.session_id ?? null,
    type: "OCCLUSION_PREDICTED",
    severity: "WARNING",
    message: "Occlusion predicted in 14 minutes",
    triggered_at: new Date(Date.now() - 480_000).toISOString(),
    acknowledged_at: null,
    escalation_level: 2,
    is_resolved: false,
    patient_name: patients[1]?.name ?? "",
    room_number: patients[1]?.room_number ?? "",
    bed_number: patients[1]?.bed_number ?? ""
  }
];

const devices: MockDevice[] = patients.slice(0, 8).map((patient, index) => ({
  id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  device_type: index % 2 === 0 ? "CAM_MODULE" : "BUBBLE_DETECTOR",
  mac_address: `${index % 2 === 0 ? "ESP32-CAM" : "ESP32-BUB"}-00-0${index + 1}`,
  firmware_version: index % 2 === 0 ? "1.4.2" : "1.2.0",
  ip_address: patient.ip_address,
  wifi_rssi: patient.wifi_rssi,
  battery_level: patient.battery_level,
  last_seen: patient.last_telemetry_at,
  is_online: Boolean(patient.is_online),
  bed_number: patient.bed_number,
  room_number: patient.room_number,
  ward_name: patient.ward_name
}));

const telemetry: MockTelemetry[] = Array.from({ length: 80 }, (_, index) => ({
  timestamp: new Date(Date.now() - (79 - index) * 60_000).toISOString(),
  dpm: Math.max(0, 62 + Math.sin(index / 4) * 7 - (index > 55 ? (index - 55) * 0.8 : 0)),
  flow_rate_ml_hr: Math.max(0, 96 + Math.sin(index / 4) * 8 - (index > 55 ? (index - 55) * 1.2 : 0)),
  alarm_active: index > 74,
  session_id: "60000000-0000-4000-8000-000000000001",
  device_id: "50000000-0000-4000-8000-000000000001"
}));

const pushAlert = (input: Omit<MockAlert, "id" | "triggered_at" | "acknowledged_at" | "escalation_level" | "is_resolved" | "patient_name" | "room_number" | "bed_number">) => {
  const patient = patients.find((item) => item.id === input.patient_id);
  const existing = alerts.find((alert) => alert.session_id === input.session_id && alert.type === input.type && !alert.is_resolved);
  if (existing) return existing;
  const alert: MockAlert = {
    ...input,
    id: randomUUID(),
    triggered_at: new Date().toISOString(),
    acknowledged_at: null,
    escalation_level: input.severity === "CRITICAL" ? 2 : 1,
    is_resolved: false,
    patient_name: patient?.name ?? "Patient",
    room_number: patient?.room_number ?? "-",
    bed_number: patient?.bed_number ?? "-"
  };
  alerts = [alert, ...alerts];
  io.emit("alert:new", alert);
  return alert;
};

const findPatientForDevice = (deviceId: string) => {
  const device = devices.find((item) => item.id === deviceId || item.mac_address === deviceId);
  if (!device) return undefined;
  return patients.find((patient) => patient.bed_number === device.bed_number && patient.room_number === device.room_number);
};

io.on("connection", (socket) => {
  socket.on("subscribe:ward", (wardId: string) => socket.join(`ward:${wardId}`));
  socket.on("subscribe:patient", (patientId: string) => socket.join(`patient:${patientId}`));
});

app.get("/health", (_req, res) => res.json({ ok: true, name: "DripSense AI Mock API" }));
app.post("/api/auth/login", (req, res) => {
  if (req.body?.password !== "Password123!") return res.status(401).json({ error: "Invalid credentials" });
  res.json({ accessToken: "mock-access-token", staff });
});
app.post("/api/auth/refresh", (_req, res) => res.json({ accessToken: "mock-access-token", staff }));
app.post("/api/auth/logout", (_req, res) => res.status(204).send());
app.post("/api/auth/forgot-password", (_req, res) => res.json({ ok: true }));
app.post("/api/auth/reset-password", (_req, res) => res.json({ ok: true }));

app.get("/api/patients", (req, res) => {
  const search = String(req.query.search ?? "").toLowerCase();
  const data = search ? patients.filter((patient) => patient.name.toLowerCase().includes(search) || patient.mrn.toLowerCase().includes(search)) : patients;
  res.json({ data });
});
app.get("/api/patients/:id", (req, res) => {
  const patient = patients.find((item) => item.id === req.params.id);
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  const latest = [...telemetry].reverse().find((point) => point.session_id === patient.session_id) ?? telemetry.at(-1);
  return res.json({
    ...patient,
    active_session: { id: patient.session_id, fluid_type: patient.fluid_type, volume_ml: patient.volume_ml, rate_ml_hr: patient.rate_ml_hr, status: "ACTIVE" },
    device: devices.find((device) => device.ip_address === patient.ip_address),
    latest_telemetry: latest,
    open_alerts: alerts.filter((alert) => alert.patient_id === patient.id)
  });
});
app.get("/api/patients/:id/history", (_req, res) => res.json({ data: [{ id: "h1", fluid_type: "Normal Saline 0.9%", volume_ml: 1000, rate_ml_hr: 95, started_at: new Date(Date.now() - 86_400_000).toISOString(), completed_at: new Date(Date.now() - 80_000_000).toISOString(), status: "COMPLETED" }] }));
app.get("/api/patients/:id/alerts", (req, res) => res.json({ data: alerts.filter((alert) => alert.patient_id === req.params.id) }));
app.get("/api/telemetry/:sessionId", (req, res) => res.json({ data: telemetry.filter((point) => !point.session_id || point.session_id === req.params.sessionId).slice(-120) }));
app.post("/api/telemetry", (req, res) => {
  const deviceId = String(req.body?.deviceId ?? devices[0]?.id ?? "");
  const patient = findPatientForDevice(deviceId) ?? patients[0];
  const device = devices.find((item) => item.id === deviceId || item.mac_address === deviceId) ?? devices[0];
  if (!patient || !device) return res.status(404).json({ error: "Device not found" });

  const dpm = Number(req.body?.dpm ?? Math.round(Number(req.body?.flowRateMlHr ?? patient.flow_rate_ml_hr) / 1.5));
  const flowRate = Number(req.body?.flowRateMlHr ?? Math.round(dpm * 1.5));
  const alarmActive = Boolean(req.body?.alarmActive);
  const timestamp = typeof req.body?.timestamp === "string" ? req.body.timestamp : new Date().toISOString();
  const point: MockTelemetry = {
    timestamp,
    dpm,
    flow_rate_ml_hr: flowRate,
    alarm_active: alarmActive,
    session_id: patient.session_id,
    device_id: device.id
  };
  if (typeof req.body?.raw === "number") point.raw_sensor = req.body.raw;
  if (typeof req.body?.baseline === "number") point.baseline_sensor = req.body.baseline;
  telemetry.push(point);
  if (device.id === devices[0]?.id) lastPrimaryTelemetryAt = Date.now();
  patient.dpm = dpm;
  patient.flow_rate_ml_hr = flowRate;
  patient.bubble_alarm = alarmActive;
  patient.is_online = true;
  patient.last_telemetry_at = timestamp;
  device.is_online = true;
  device.last_seen = timestamp;
  io.emit("telemetry:update", {
    patientId: patient.id,
    sessionId: patient.session_id,
    dpm,
    flowRate,
    bubbleAlarm: alarmActive,
    timestamp
  });
  if (alarmActive) {
    pushAlert({
      patient_id: patient.id,
      device_id: device.id,
      session_id: patient.session_id,
      type: "AIR_BUBBLE",
      severity: "CRITICAL",
      message: "Air bubble detected by IR sensor"
    });
  }
  if (dpm === 0) {
    pushAlert({
      patient_id: patient.id,
      device_id: device.id,
      session_id: patient.session_id,
      type: "NO_DRIP",
      severity: "CRITICAL",
      message: "No drip motion detected"
    });
  }
  return res.status(201).json(point);
});
app.post("/api/telemetry/prediction", (req, res) => {
  const sessionId = String(req.body?.sessionId ?? patients[0]?.session_id ?? "");
  const patient = patients.find((item) => item.session_id === sessionId) ?? patients[0];
  const device = devices.find((item) => item.bed_number === patient?.bed_number) ?? devices[0];
  if (!patient || !device) return res.status(404).json({ error: "Session not found" });
  const minsRemaining = Number(req.body?.minsRemaining ?? 14);
  const prediction = {
    id: randomUUID(),
    session_id: sessionId,
    predicted_failure_at: req.body?.predictedFailureAt ?? new Date(Date.now() + minsRemaining * 60_000).toISOString(),
    confidence_score: Number(req.body?.confidenceScore ?? 0.82),
    trend_slope: Number(req.body?.trendSlope ?? -2.4),
    consecutive_drops: Number(req.body?.consecutiveDrops ?? 3),
    generated_at: new Date().toISOString()
  };
  io.emit("prediction:update", {
    sessionId,
    predictedFailureAt: prediction.predicted_failure_at,
    confidence: prediction.confidence_score,
    minsRemaining
  });
  pushAlert({
    patient_id: patient.id,
    device_id: device.id,
    session_id: patient.session_id,
    type: "OCCLUSION_PREDICTED",
    severity: prediction.confidence_score > 0.8 ? "CRITICAL" : "WARNING",
    message: `Occlusion predicted in ${Math.round(minsRemaining)} minutes`
  });
  return res.status(201).json(prediction);
});

app.get("/api/alerts", (_req, res) => res.json({ data: alerts.filter((alert) => !alert.is_resolved) }));
app.get("/api/alerts/log", (_req, res) => res.json({ data: alerts }));
app.patch("/api/alerts/:id/acknowledge", (req, res) => {
  alerts = alerts.map((alert) => alert.id === req.params.id ? { ...alert, acknowledged_at: new Date().toISOString(), is_resolved: true } : alert);
  res.json(alerts.find((alert) => alert.id === req.params.id));
});
app.patch("/api/alerts/:id/resolve", (req, res) => {
  alerts = alerts.map((alert) => alert.id === req.params.id ? { ...alert, is_resolved: true } : alert);
  res.json(alerts.find((alert) => alert.id === req.params.id));
});
app.get("/api/devices", (_req, res) => res.json({ data: devices }));
app.post("/api/devices", (req, res) => {
  const patient = patients.find((item) => item.bed_number === req.body?.bedNumber) ?? patients[0];
  if (!patient) return res.status(404).json({ error: "Bed not found" });
  const device: MockDevice = {
    id: randomUUID(),
    device_type: String(req.body?.deviceType ?? "CAM_MODULE"),
    mac_address: String(req.body?.macAddress ?? `ESP32-MOCK-${devices.length + 1}`),
    firmware_version: String(req.body?.firmwareVersion ?? "1.0.0"),
    ip_address: String(req.body?.ipAddress ?? patient.ip_address),
    wifi_rssi: -58,
    battery_level: 100,
    last_seen: new Date().toISOString(),
    is_online: true,
    bed_number: patient.bed_number,
    room_number: patient.room_number,
    ward_name: patient.ward_name
  };
  devices.push(device);
  return res.status(201).json(device);
});
app.patch("/api/devices/:id", (req, res) => {
  const device = devices.find((item) => item.id === req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });
  if (typeof req.body?.ipAddress === "string") device.ip_address = req.body.ipAddress;
  if (typeof req.body?.firmwareVersion === "string") device.firmware_version = req.body.firmwareVersion;
  return res.json(device);
});
app.post("/api/devices/:id/command", (req, res) => res.status(202).json({ queued: true, command: req.body?.command ?? "diagnostics" }));
app.get("/api/devices/:id/diagnostics", (req, res) => res.json(devices.find((device) => device.id === req.params.id)));
app.get("/api/analytics/ward-summary", (_req, res) => res.json({ data: [{ name: "ICU", active_patients: 3, open_alerts: 2, avg_flow_rate: 72 }] }));
app.get("/api/analytics/alert-trends", (_req, res) => res.json({ data: [{ day: "Mon", type: "AIR_BUBBLE", count: 1 }, { day: "Tue", type: "OCCLUSION_PREDICTED", count: 2 }] }));
app.get("/api/analytics/device-uptime", (_req, res) => res.json({ data: devices }));
app.get("/api/analytics/infusion-stats", (_req, res) => res.json({ data: [{ status: "COMPLETED", count: 72 }, { status: "INTERRUPTED", count: 8 }, { status: "ALARMED", count: 20 }] }));
app.post("/api/reports/patient", (_req, res) => res.json({ reportId: "mock-report", status: "queued", format: "pdf" }));
app.post("/api/reports/shift", (_req, res) => res.json({ reportId: "mock-shift", status: "queued", format: "pdf" }));
app.get("/api/reports/export", (_req, res) => res.type("text/csv").send("type,severity,message\nAIR_BUBBLE,CRITICAL,Air bubble detected"));

app.get("/stream", async (_req, res) => {
  const cameraUrl = `${esp32CamUrl}/stream`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(cameraUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok && response.body) {
      res.setHeader("Content-Type", response.headers.get("content-type") || "multipart/x-mixed-replace;boundary=frame");
      Readable.fromWeb(response.body).pipe(res);
      return;
    }
  } catch {
    // The browser will replace the image with the app's camera-unreachable state.
  }

  res.status(502).send(`Camera stream not reachable at ${cameraUrl}`);
});

setInterval(() => {
  const primary = patients[0];
  const primaryDevice = devices[0];
  if (primary && primaryDevice && Date.now() - lastPrimaryTelemetryAt > 5000) {
    primaryMockTick += 1;
    const dpm = Math.max(32, Math.round(58 + Math.sin(primaryMockTick / 2) * 7 + (Math.random() * 4 - 2)));
    const flowRate = Math.round(dpm * 1.5);
    primary.dpm = dpm;
    primary.flow_rate_ml_hr = flowRate;
    primary.bubble_alarm = false;
    primary.is_online = true;
    primary.last_telemetry_at = new Date().toISOString();
    primaryDevice.is_online = true;
    primaryDevice.last_seen = primary.last_telemetry_at;
    telemetry.push({
      timestamp: primary.last_telemetry_at,
      dpm,
      flow_rate_ml_hr: flowRate,
      alarm_active: false,
      session_id: primary.session_id,
      device_id: primaryDevice.id
    });
    if (telemetry.length > 500) telemetry.splice(0, telemetry.length - 500);
    io.emit("telemetry:update", {
      patientId: primary.id,
      sessionId: primary.session_id,
      dpm,
      flowRate,
      bubbleAlarm: primary.bubble_alarm,
      timestamp: primary.last_telemetry_at
    });
  }

  const patient = patients[1];
  if (!patient) return;
  const dpm = Math.max(25, Number(patient.dpm) + (Math.random() > 0.5 ? 1 : -1));
  patient.dpm = dpm;
  patient.flow_rate_ml_hr = Math.round(dpm * 1.5);
  patient.last_telemetry_at = new Date().toISOString();
  io.emit("telemetry:update", {
    patientId: patient.id,
    sessionId: patient.session_id,
    dpm: patient.dpm,
    flowRate: patient.flow_rate_ml_hr,
    bubbleAlarm: patient.bubble_alarm,
    timestamp: patient.last_telemetry_at
  });
}, 3000);

setInterval(async () => {
  if (!esp32CamIp || esp32StatsMode === "off") return;
  const patient = patients[0];
  const device = devices[0];
  if (!patient || !device) return;

  try {
    const response = await fetch(`${esp32CamUrl}/stats`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return;
    const stats = (await response.json()) as { drops?: number; dpm?: number; rate?: number };
    const now = Date.now();
    const drops = Number(stats.drops ?? lastEsp32Drops ?? 0);
    const secondsElapsed = lastEsp32PollAt ? Math.max(0.5, (now - lastEsp32PollAt) / 1000) : 1;
    const dropDelta = lastEsp32Drops === null ? 0 : Math.max(0, drops - lastEsp32Drops);
    const computedDpm = Math.round((dropDelta / secondsElapsed) * 60);
    const rate = Number(stats.rate ?? patient.flow_rate_ml_hr);
    const firmwareDpm = typeof stats.dpm === "number" ? Number(stats.dpm) : null;
    const dpmFromRate = Number.isFinite(rate) && rate > 0 ? Math.round(rate / 3) : null;
    if (dropDelta > 0) lastEsp32DropAt = now;
    lastEsp32Drops = drops;
    lastEsp32PollAt = now;
    const secondsSinceDrop = lastEsp32DropAt ? (now - lastEsp32DropAt) / 1000 : Number.POSITIVE_INFINITY;
    patient.dpm = Math.max(0, Math.round(firmwareDpm ?? dpmFromRate ?? (secondsSinceDrop > 8 ? 0 : computedDpm)));
    patient.flow_rate_ml_hr = Math.max(0, Math.round(rate));
    patient.is_online = true;
    patient.last_telemetry_at = new Date().toISOString();
    device.ip_address = patient.ip_address;
    device.is_online = true;
    device.last_seen = patient.last_telemetry_at;
    telemetry.push({
      timestamp: patient.last_telemetry_at,
      dpm: patient.dpm,
      flow_rate_ml_hr: patient.flow_rate_ml_hr,
      alarm_active: patient.bubble_alarm,
      session_id: patient.session_id,
      device_id: device.id
    });
    if (telemetry.length > 500) telemetry.splice(0, telemetry.length - 500);
    io.emit("telemetry:update", {
      patientId: patient.id,
      sessionId: patient.session_id,
      dpm: patient.dpm,
      flowRate: patient.flow_rate_ml_hr,
      bubbleAlarm: patient.bubble_alarm,
      timestamp: patient.last_telemetry_at
    });
  } catch {
    patient.is_online = false;
    device.is_online = false;
    io.emit("device:status", {
      deviceId: device.id,
      isOnline: false,
      rssi: patient.wifi_rssi,
      battery: patient.battery_level
    });
  }
}, 1000);

server.listen(env.SERVER_PORT, () => {
  process.stdout.write(`DripSense mock API running on http://localhost:${env.SERVER_PORT}\nESP32-CAM: ${esp32CamUrl}\nESP32 stats polling: ${esp32StatsMode}\nOpenCV bridge: ${openCvBridgeMode}\n`);

  if (openCvBridgeMode === "on" && esp32CamIp) {
    const python = process.env.PYTHON_EXECUTABLE ?? "python";
    const bridgePath = resolve(process.cwd(), "../../tools/opencv_bridge.py");
    const child = spawn(python, [
      bridgePath,
      "--stream",
      `${esp32CamUrl}/stream`,
      "--backend",
      `http://localhost:${env.SERVER_PORT}`
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    child.stdout.on("data", (data: Buffer) => process.stdout.write(`[opencv] ${data.toString()}`));
    child.stderr.on("data", (data: Buffer) => process.stderr.write(`[opencv] ${data.toString()}`));
    child.on("exit", (code) => process.stderr.write(`[opencv] bridge exited with code ${code ?? "unknown"}\n`));
  }
});
