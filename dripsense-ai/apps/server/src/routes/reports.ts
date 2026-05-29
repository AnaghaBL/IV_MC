import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";

const router = Router();

router.post("/patient", (_req, res) => res.json({ reportId: randomUUID(), status: "queued", format: "pdf" }));
router.post("/shift", (_req, res) => res.json({ reportId: randomUUID(), status: "queued", format: "pdf" }));
router.get("/export", asyncHandler(async (req, res) => {
  const result = await query(`select type,severity,message,triggered_at,acknowledged_at,is_resolved from alerts order by triggered_at desc limit 500`);
  const header = "type,severity,message,triggered_at,acknowledged_at,is_resolved";
  const rows = result.rows.map((row) => [row.type, row.severity, `"${String(row.message).replaceAll('"', '""')}"`, row.triggered_at, row.acknowledged_at, row.is_resolved].join(","));
  res.setHeader("content-type", "text/csv");
  res.setHeader("content-disposition", `attachment; filename="${req.query.type ?? "alerts"}.csv"`);
  return res.send([header, ...rows].join("\n"));
}));

export default router;
