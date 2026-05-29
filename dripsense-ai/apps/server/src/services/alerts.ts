import type { AppSocketServer } from "../socket/index.js";
import { query } from "../db/pool.js";
import type { AlertSeverity, AlertType } from "../types/domain.js";

interface AlertInput {
  patientId: string;
  deviceId: string;
  sessionId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
}

export const createAlert = async (io: AppSocketServer, input: AlertInput) => {
  const existing = await query<{ id: string }>(
    `select id from alerts where session_id = $1 and type = $2 and is_resolved = false limit 1`,
    [input.sessionId, input.type]
  );
  if (existing.rowCount) return existing.rows[0];

  const result = await query(
    `insert into alerts (patient_id, device_id, session_id, type, severity, message)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.patientId, input.deviceId, input.sessionId, input.type, input.severity, input.message]
  );
  const alert = result.rows[0];
  if (!alert) throw new Error("Alert insert failed");
  io.to(`patient:${input.patientId}`).emit("alert:new", alert);
  io.emit("alert:new", alert);
  setTimeout(() => {
    io.emit("alert:escalated", { alertId: alert.id, newLevel: 2 });
    void query(`update alerts set escalation_level = 2 where id = $1 and acknowledged_at is null`, [alert.id]);
  }, 5 * 60 * 1000);
  return alert;
};

export const evaluateTelemetryAlert = async (
  io: AppSocketServer,
  telemetry: { patientId: string; deviceId: string; sessionId: string; dpm: number; flowRate: number; alarmActive: boolean }
) => {
  if (telemetry.alarmActive) {
    await createAlert(io, {
      patientId: telemetry.patientId,
      deviceId: telemetry.deviceId,
      sessionId: telemetry.sessionId,
      type: "AIR_BUBBLE",
      severity: "CRITICAL",
      message: "Air-in-line / embolism risk detected by IR sensor"
    });
  }
  if (telemetry.dpm === 0) {
    await createAlert(io, {
      patientId: telemetry.patientId,
      deviceId: telemetry.deviceId,
      sessionId: telemetry.sessionId,
      type: "NO_DRIP",
      severity: "CRITICAL",
      message: "No drip motion detected"
    });
  }
  if (telemetry.flowRate > 220) {
    await createAlert(io, {
      patientId: telemetry.patientId,
      deviceId: telemetry.deviceId,
      sessionId: telemetry.sessionId,
      type: "RAPID_FLOW",
      severity: "WARNING",
      message: "Flow rate exceeds configured baseline"
    });
  }
};
