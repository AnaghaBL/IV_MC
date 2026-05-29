import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";
import { requireDeviceKey } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AppSocketServer } from "../socket/index.js";
import { createAlert, evaluateTelemetryAlert } from "../services/alerts.js";

const telemetrySchema = z.object({
  deviceId: z.string().uuid(),
  raw: z.number().optional(),
  baseline: z.number().optional(),
  alarmActive: z.boolean().default(false),
  timestamp: z.string().datetime().optional(),
  dripCount: z.number().int().nonnegative().optional(),
  flowRateMlHr: z.number().nonnegative().optional(),
  dpm: z.number().nonnegative().optional()
});

const predictionSchema = z.object({
  sessionId: z.string().uuid(),
  predictedFailureAt: z.string().datetime(),
  confidenceScore: z.number().min(0).max(1),
  trendSlope: z.number(),
  consecutiveDrops: z.number().int().nonnegative(),
  minsRemaining: z.number().nonnegative()
});

export const telemetryRoutes = (io: AppSocketServer) => {
  const router = Router();

  router.post("/", requireDeviceKey, validate(telemetrySchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof telemetrySchema>;
    const deviceResult = await query<{
      session_id: string;
      patient_id: string;
      bed_id: string;
    }>(
      `select s.id as session_id, s.patient_id, d.bed_id
       from devices d
       left join patients p on p.bed_id = d.bed_id and p.status = 'ACTIVE'
       left join infusion_sessions s on s.status = 'ACTIVE' and (s.device_id = d.id or s.patient_id = p.id)
       where d.id = $1`,
      [body.deviceId]
    );
    const device = deviceResult.rows[0];
    if (!device?.session_id) return res.status(404).json({ error: "Active session not found for device" });

    const dpm = body.dpm ?? Math.round((body.flowRateMlHr ?? 0) / 1.5);
    const flowRate = body.flowRateMlHr ?? dpm * 1.5;
    const timestamp = body.timestamp ?? new Date().toISOString();
    const result = await query(
      `insert into telemetry (device_id, session_id, drip_count, flow_rate_ml_hr, dpm, raw_sensor, baseline_sensor, alarm_active, timestamp)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [body.deviceId, device.session_id, body.dripCount ?? null, flowRate, dpm, body.raw ?? null, body.baseline ?? null, body.alarmActive, timestamp]
    );
    await query(`update devices set last_seen = now(), is_online = true, updated_at = now() where id = $1`, [body.deviceId]);

    const payload = {
      patientId: device.patient_id,
      sessionId: device.session_id,
      dpm,
      flowRate,
      bubbleAlarm: body.alarmActive,
      timestamp
    };
    io.to(`patient:${device.patient_id}`).emit("telemetry:update", payload);
    io.emit("telemetry:update", payload);
    await evaluateTelemetryAlert(io, { patientId: device.patient_id, deviceId: body.deviceId, sessionId: device.session_id, dpm, flowRate, alarmActive: body.alarmActive });
    return res.status(201).json(result.rows[0]);
  }));

  router.post("/prediction", requireDeviceKey, validate(predictionSchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof predictionSchema>;
    const result = await query<{ patient_id: string; device_id: string }>(
      `select patient_id, device_id from infusion_sessions where id = $1`,
      [body.sessionId]
    );
    const session = result.rows[0];
    if (!session) return res.status(404).json({ error: "Session not found" });
    const prediction = await query(
      `insert into predictions (session_id, predicted_failure_at, confidence_score, trend_slope, consecutive_drops)
       values ($1,$2,$3,$4,$5) returning *`,
      [body.sessionId, body.predictedFailureAt, body.confidenceScore, body.trendSlope, body.consecutiveDrops]
    );
    io.emit("prediction:update", {
      sessionId: body.sessionId,
      predictedFailureAt: body.predictedFailureAt,
      confidence: body.confidenceScore,
      minsRemaining: body.minsRemaining
    });
    await createAlert(io, {
      patientId: session.patient_id,
      deviceId: session.device_id,
      sessionId: body.sessionId,
      type: "OCCLUSION_PREDICTED",
      severity: body.confidenceScore > 0.8 ? "CRITICAL" : "WARNING",
      message: `Occlusion predicted in ${Math.round(body.minsRemaining)} minutes`
    });
    return res.status(201).json(prediction.rows[0]);
  }));

  router.get("/:sessionId", asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 120), 1000);
    const result = await query(
      `select * from telemetry where session_id = $1 order by timestamp desc limit $2`,
      [req.params.sessionId, limit]
    );
    return res.json({ data: result.rows.reverse() });
  }));

  return router;
};
