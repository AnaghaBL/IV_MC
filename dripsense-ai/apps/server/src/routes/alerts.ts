import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const result = await query(
    `select a.*, p.name as patient_name, b.room_number, b.bed_number
     from alerts a
     join patients p on p.id = a.patient_id
     left join beds b on b.id = p.bed_id
     where a.is_resolved = false
     order by case a.severity when 'CRITICAL' then 1 when 'WARNING' then 2 else 3 end, a.triggered_at desc`
  );
  return res.json({ data: result.rows });
}));

router.patch("/:id/acknowledge", asyncHandler(async (req, res) => {
  const staffId = req.staff?.id;
  const result = await query(
    `update alerts set acknowledged_at = now(), acknowledged_by = $2,
      response_time_seconds = extract(epoch from (now() - triggered_at))::int, updated_at = now()
     where id = $1 returning *`,
    [req.params.id, staffId]
  );
  return res.json(result.rows[0]);
}));

router.patch("/:id/resolve", asyncHandler(async (req, res) => {
  const result = await query(`update alerts set is_resolved = true, updated_at = now() where id = $1 returning *`, [req.params.id]);
  return res.json(result.rows[0]);
}));

router.get("/log", asyncHandler(async (_req, res) => {
  const result = await query(`select * from alerts order by triggered_at desc limit 500`);
  return res.json({ data: result.rows });
}));

export default router;
