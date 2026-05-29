import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();
const deviceSchema = z.object({
  hospitalId: z.string().uuid(),
  bedId: z.string().uuid().nullable(),
  deviceType: z.enum(["CAM_MODULE", "BUBBLE_DETECTOR"]),
  macAddress: z.string().min(6),
  firmwareVersion: z.string().min(1),
  ipAddress: z.string().ip().optional()
});

router.get("/", asyncHandler(async (_req, res) => {
  const result = await query(
    `select d.*, b.bed_number, b.room_number, w.name as ward_name
     from devices d
     left join beds b on b.id = d.bed_id
     left join wards w on w.id = b.ward_id
     order by d.last_seen desc nulls last`
  );
  return res.json({ data: result.rows });
}));

router.post("/", requireRole("ADMIN", "BIOMEDICAL"), validate(deviceSchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof deviceSchema>;
  const result = await query(
    `insert into devices (hospital_id, bed_id, device_type, mac_address, firmware_version, ip_address)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [body.hospitalId, body.bedId, body.deviceType, body.macAddress, body.firmwareVersion, body.ipAddress ?? null]
  );
  return res.status(201).json(result.rows[0]);
}));

router.patch("/:id", requireRole("ADMIN", "BIOMEDICAL"), asyncHandler(async (req, res) => {
  const result = await query(
    `update devices set ip_address = coalesce($2, ip_address), firmware_version = coalesce($3, firmware_version), updated_at = now()
     where id = $1 returning *`,
    [req.params.id, req.body.ipAddress ?? null, req.body.firmwareVersion ?? null]
  );
  return res.json(result.rows[0]);
}));

router.post("/:id/command", requireRole("ADMIN", "BIOMEDICAL", "NURSE"), asyncHandler(async (req, res) => {
  const command = typeof req.body.command === "string" ? req.body.command : "diagnostics";
  await query(`insert into audit_logs (staff_id, action, entity_type, entity_id, metadata) values ($1,$2,'device',$3,$4)`, [
    req.staff?.id ?? null,
    `device.command.${command}`,
    req.params.id,
    { command }
  ]);
  return res.status(202).json({ queued: true, command });
}));

router.get("/:id/diagnostics", asyncHandler(async (req, res) => {
  const result = await query(
    `select d.*, coalesce((select json_agg(t order by timestamp desc) from (select * from telemetry where device_id = $1 order by timestamp desc limit 20) t), '[]') as recent_readings
     from devices d where d.id = $1`,
    [req.params.id]
  );
  return res.json(result.rows[0]);
}));

export default router;
