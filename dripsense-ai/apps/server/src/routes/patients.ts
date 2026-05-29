import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();
const patientSchema = z.object({
  bedId: z.string().uuid(),
  name: z.string().min(2),
  mrn: z.string().min(3),
  age: z.number().int().min(0).max(130),
  gender: z.string().min(1),
  diagnosis: z.string().min(2),
  attendingDoctorId: z.string().uuid(),
  primaryNurseId: z.string().uuid()
});

router.get("/", asyncHandler(async (req, res) => {
  const ward = typeof req.query.ward === "string" ? req.query.ward : null;
  const status = typeof req.query.status === "string" ? req.query.status : "ACTIVE";
  const search = typeof req.query.search === "string" ? `%${req.query.search}%` : null;
  const result = await query(
    `select p.*, b.bed_number, b.room_number, w.id as ward_id, w.name as ward_name,
      doctor.name as attending_doctor, doctor.email as attending_doctor_email, nurse.name as primary_nurse,
      s.id as session_id, s.fluid_type, s.volume_ml, s.rate_ml_hr, s.started_at,
      d.id as device_id, d.ip_address, d.is_online, d.wifi_rssi, d.battery_level,
      coalesce(t.dpm, 0) as dpm, coalesce(t.flow_rate_ml_hr, s.rate_ml_hr, 0) as flow_rate_ml_hr,
      coalesce(t.alarm_active, false) as bubble_alarm, t.timestamp as last_telemetry_at,
      coalesce(max(case a.severity when 'CRITICAL' then 100 when 'WARNING' then 60 when 'INFO' then 20 else 0 end), 0) as risk_score
     from patients p
     join beds b on b.id = p.bed_id
     join wards w on w.id = b.ward_id
     left join staff doctor on doctor.id = p.attending_doctor_id
     left join staff nurse on nurse.id = p.primary_nurse_id
     left join infusion_sessions s on s.patient_id = p.id and s.status = 'ACTIVE'
     left join devices d on d.id = s.device_id
     left join lateral (
       select * from telemetry where session_id = s.id order by timestamp desc limit 1
     ) t on true
     left join alerts a on a.patient_id = p.id and a.is_resolved = false
     where p.status = $1 and ($2::uuid is null or w.id = $2) and ($3::text is null or p.name ilike $3 or p.mrn ilike $3)
     group by p.id,b.bed_number,b.room_number,w.id,w.name,doctor.name,doctor.email,nurse.name,s.id,d.id,t.id
     order by risk_score desc, b.room_number asc`,
    [status, ward, search]
  );
  return res.json({ data: result.rows });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const result = await query(
    `select p.*, row_to_json(b.*) as bed, row_to_json(w.*) as ward,
      row_to_json(s.*) as active_session, row_to_json(d.*) as device,
      (select row_to_json(t.*) from telemetry t where t.session_id = s.id order by timestamp desc limit 1) as latest_telemetry,
      coalesce((select json_agg(a.* order by triggered_at desc) from alerts a where a.patient_id = p.id and a.is_resolved = false), '[]') as open_alerts
     from patients p
     join beds b on b.id = p.bed_id
     join wards w on w.id = b.ward_id
     left join infusion_sessions s on s.patient_id = p.id and s.status = 'ACTIVE'
     left join devices d on d.id = s.device_id
     where p.id = $1`,
    [req.params.id]
  );
  const patient = result.rows[0];
  return patient ? res.json(patient) : res.status(404).json({ error: "Patient not found" });
}));

router.post("/", requireRole("ADMIN", "DOCTOR"), validate(patientSchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof patientSchema>;
  const result = await query(
    `insert into patients (hospital_id, bed_id, name, mrn, age, gender, diagnosis, attending_doctor_id, primary_nurse_id)
     select b.hospital_id, $1, $2, $3, $4, $5, $6, $7, $8 from beds b where b.id = $1 returning *`,
    [body.bedId, body.name, body.mrn, body.age, body.gender, body.diagnosis, body.attendingDoctorId, body.primaryNurseId]
  );
  return res.status(201).json(result.rows[0]);
}));

router.patch("/:id", requireRole("ADMIN", "DOCTOR", "NURSE"), asyncHandler(async (req, res) => {
  const result = await query(`update patients set diagnosis = coalesce($2, diagnosis), updated_at = now() where id = $1 returning *`, [
    req.params.id,
    typeof req.body.diagnosis === "string" ? req.body.diagnosis : null
  ]);
  return res.json(result.rows[0]);
}));

router.get("/:id/history", asyncHandler(async (req, res) => {
  const result = await query(`select * from infusion_sessions where patient_id = $1 order by started_at desc`, [req.params.id]);
  return res.json({ data: result.rows });
}));

router.get("/:id/alerts", asyncHandler(async (req, res) => {
  const result = await query(`select * from alerts where patient_id = $1 order by triggered_at desc`, [req.params.id]);
  return res.json({ data: result.rows });
}));

export default router;
