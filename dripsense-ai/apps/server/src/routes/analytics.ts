import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";

const router = Router();

router.get("/ward-summary", asyncHandler(async (_req, res) => {
  const result = await query(
    `select w.id, w.name, count(distinct p.id) active_patients,
      count(distinct a.id) open_alerts,
      round(avg(t.flow_rate_ml_hr)::numeric, 1) avg_flow_rate
     from wards w
     left join beds b on b.ward_id = w.id
     left join patients p on p.bed_id = b.id and p.status = 'ACTIVE'
     left join alerts a on a.patient_id = p.id and a.is_resolved = false
     left join infusion_sessions s on s.patient_id = p.id and s.status = 'ACTIVE'
     left join lateral (select flow_rate_ml_hr from telemetry where session_id = s.id order by timestamp desc limit 1) t on true
     group by w.id order by w.name`
  );
  return res.json({ data: result.rows });
}));

router.get("/alert-trends", asyncHandler(async (_req, res) => {
  const result = await query(`select date_trunc('day', triggered_at) day, type, count(*) from alerts group by 1,2 order by 1`);
  return res.json({ data: result.rows });
}));

router.get("/device-uptime", asyncHandler(async (_req, res) => {
  const result = await query(`select id, mac_address, is_online, last_seen, battery_level, wifi_rssi from devices order by mac_address`);
  return res.json({ data: result.rows });
}));

router.get("/infusion-stats", asyncHandler(async (_req, res) => {
  const result = await query(`select status, count(*) from infusion_sessions group by status`);
  return res.json({ data: result.rows });
}));

export default router;
