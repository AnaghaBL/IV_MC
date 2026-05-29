import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";
import { createPdfBuffer, type PdfSection } from "../services/pdf.js";

const router = Router();

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDate = (value: unknown) => {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clinicalProfile = (patient: Record<string, unknown>) => {
  const diagnosis = String(patient.diagnosis ?? "Infusion monitoring");
  return {
    firstContactName: "Emergency Contact",
    firstContactEmail: `${String(patient.mrn ?? "patient").toLowerCase().replace(/[^a-z0-9]+/g, "")}@family.example`,
    firstContactPhone: "+91 98765 43210",
    allergies: diagnosis.toLowerCase().includes("sepsis") ? "Penicillin allergy noted. Monitor for rash, wheeze, or hypotension after antibiotic infusion." : "No known drug allergies recorded in this prototype chart.",
    previousResults: diagnosis.toLowerCase().includes("pneumonia")
      ? "Previous chest imaging: lower-zone infiltrates. Prior CBC showed raised WBC. Oxygen saturation trend reviewed."
      : "Previous vitals and basic metabolic panel reviewed. No conflicting infusion result recorded in this prototype chart.",
    prescriptions: `${String(patient.fluid_type ?? "IV fluid")} at ${String(patient.rate_ml_hr ?? "ordered")} ml/hr. Continue diagnosis-specific medication chart as prescribed. Escalate if DPM falls below ordered range or alarm is active.`,
    history: `Admitted for ${diagnosis}. Active IV monitoring session is linked to ESP32-CAM telemetry and alert timeline.`
  };
};

const reportSections = (
  patient: Record<string, unknown>,
  latest: Record<string, unknown> | null,
  telemetryRows: Record<string, unknown>[],
  alertRows: Record<string, unknown>[]
): PdfSection[] => {
  const profile = clinicalProfile(patient);
  const dpm = numberValue(latest?.dpm);
  const flow = numberValue(latest?.flow_rate_ml_hr);
  const status = !patient.is_online ? "Device offline" : latest?.alarm_active ? "Alarm active" : dpm <= 20 ? "Needs attention" : "Stable";
  return [
    {
      title: "Patient Summary",
      rows: [
        ["Patient", `${patient.name} (${patient.mrn})`],
        ["Age / Gender", `${patient.age} / ${patient.gender}`],
        ["Diagnosis", String(patient.diagnosis ?? "Not recorded")],
        ["Location", `${patient.ward_name}, Room ${patient.room_number}, Bed ${patient.bed_number}`],
        ["Status", status],
        ["Generated For", String(patient.attending_doctor ?? "Attending doctor")]
      ]
    },
    {
      title: "Contacts And Care Team",
      rows: [
        ["Assigned Doctor", `${patient.attending_doctor ?? "Unassigned"} <${patient.attending_doctor_email ?? "doctor not configured"}>`],
        ["Primary Nurse", String(patient.primary_nurse ?? "Unassigned")],
        ["Patient First Contact", `${profile.firstContactName} | ${profile.firstContactPhone} | ${profile.firstContactEmail}`]
      ]
    },
    {
      title: "Clinical Details",
      rows: [
        ["Patient History", profile.history],
        ["Allergies", profile.allergies],
        ["Previous Hospital Results", profile.previousResults],
        ["Prescriptions", profile.prescriptions]
      ]
    },
    {
      title: "Active Infusion",
      rows: [
        ["Fluid", String(patient.fluid_type ?? "No active IV")],
        ["Ordered Rate", `${patient.rate_ml_hr ?? "N/A"} ml/hr`],
        ["Volume", `${patient.volume_ml ?? "N/A"} ml`],
        ["Started", formatDate(patient.started_at)],
        ["Current DPM", dpm.toFixed(1)],
        ["Current Flow", `${flow.toFixed(1)} ml/hr`]
      ]
    },
    {
      title: "Device Snapshot",
      rows: [
        ["Device", String(patient.device_type ?? "N/A")],
        ["ESP32-CAM IP", String(patient.ip_address ?? "Not configured")],
        ["WiFi RSSI", `${patient.wifi_rssi ?? "N/A"} dBm`],
        ["Battery", `${patient.battery_level ?? "N/A"}%`],
        ["Last Telemetry", formatDate(patient.last_telemetry_at)]
      ]
    },
    {
      title: "Recent Telemetry",
      rows: telemetryRows.length
        ? telemetryRows.slice(0, 15).map((row, index) => [`Sample ${index + 1}`, `${formatDate(row.timestamp)} | Drops ${row.drip_count ?? "-"} | DPM ${Number(row.dpm).toFixed(1)} | Flow ${Number(row.flow_rate_ml_hr).toFixed(1)} ml/hr | Alarm ${row.alarm_active ? "Yes" : "No"}`])
        : [["Samples", "No telemetry received yet."]]
    },
    {
      title: "Alert Timeline",
      rows: alertRows.length
        ? alertRows.map((row, index) => [`Alert ${index + 1}`, `${formatDate(row.triggered_at)} | ${String(row.type).replaceAll("_", " ")} | ${row.severity} | ${row.message} | ${row.is_resolved ? "Resolved" : row.acknowledged_at ? "Acknowledged" : "Open"}`])
        : [["Alerts", "No alerts recorded for this patient."]]
    }
  ];
};

router.post("/patient", (_req, res) => res.json({ reportId: randomUUID(), status: "queued", format: "pdf" }));
router.post("/shift", (_req, res) => res.json({ reportId: randomUUID(), status: "queued", format: "pdf" }));
router.get("/patient/:id/download", asyncHandler(async (req, res) => {
  const patientResult = await query(
    `select p.id, p.name, p.mrn, p.age, p.gender, p.diagnosis, p.admission_date,
      b.room_number, b.bed_number, w.name as ward_name,
      doctor.name as attending_doctor, doctor.email as attending_doctor_email, nurse.name as primary_nurse,
      s.id as session_id, s.fluid_type, s.volume_ml, s.rate_ml_hr, s.started_at,
      d.device_type, d.ip_address, d.is_online, d.wifi_rssi, d.battery_level,
      (select row_to_json(t.*) from telemetry t where t.session_id = s.id order by timestamp desc limit 1) as latest_telemetry
     from patients p
     join beds b on b.id = p.bed_id
     join wards w on w.id = b.ward_id
     left join staff doctor on doctor.id = p.attending_doctor_id
     left join staff nurse on nurse.id = p.primary_nurse_id
     left join infusion_sessions s on s.patient_id = p.id and s.status = 'ACTIVE'
     left join devices d on d.id = s.device_id
     where p.id = $1`,
    [req.params.id]
  );
  const patient = patientResult.rows[0];
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const alertsResult = await query(
    `select type, severity, message, triggered_at, acknowledged_at, is_resolved
     from alerts where patient_id = $1 order by triggered_at desc limit 20`,
    [req.params.id]
  );
  const telemetryResult = await query(
    `select drip_count, dpm, flow_rate_ml_hr, alarm_active, timestamp
     from telemetry where session_id = $1 order by timestamp desc limit 30`,
    [patient.session_id]
  );

  const latest = patient.latest_telemetry as Record<string, unknown> | null;
  const dpm = numberValue(latest?.dpm);
  const flow = numberValue(latest?.flow_rate_ml_hr);
  const status = !patient.is_online ? "Device offline" : latest?.alarm_active ? "Alarm active" : dpm <= 20 ? "Needs attention" : "Stable";
  const safeName = String(patient.name).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "patient";
  const pdf = createPdfBuffer("Patient IV Monitoring Report", reportSections(patient, latest, telemetryResult.rows, alertsResult.rows));
  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", `attachment; filename="${safeName}-iv-report.pdf"`);
  return res.send(pdf);
}));
router.post("/patient/:id/send", asyncHandler(async (req, res) => {
  const result = await query(
    `select p.name, p.mrn, p.diagnosis, doctor.name as attending_doctor, doctor.email as attending_doctor_email
     from patients p left join staff doctor on doctor.id = p.attending_doctor_id where p.id = $1`,
    [req.params.id]
  );
  const patient = result.rows[0];
  if (!patient) return res.status(404).json({ error: "Patient not found" });
  const profile = clinicalProfile(patient);
  const target = req.body?.target === "contact" ? "contact" : req.body?.target === "both" ? "both" : "doctor";
  const recipients = [
    ...(target === "doctor" || target === "both" ? [{ type: "doctor", name: patient.attending_doctor ?? "Assigned doctor", destination: patient.attending_doctor_email ?? "doctor not configured" }] : []),
    ...(target === "contact" || target === "both" ? [{ type: "first_contact", name: profile.firstContactName, destination: profile.firstContactEmail }] : [])
  ];
  return res.json({ ok: true, status: "queued", reportId: randomUUID(), recipients });
}));
router.get("/export", asyncHandler(async (req, res) => {
  const result = await query(`select type,severity,message,triggered_at,acknowledged_at,is_resolved from alerts order by triggered_at desc limit 500`);
  const header = "type,severity,message,triggered_at,acknowledged_at,is_resolved";
  const rows = result.rows.map((row) => [row.type, row.severity, `"${String(row.message).replaceAll('"', '""')}"`, row.triggered_at, row.acknowledged_at, row.is_resolved].join(","));
  res.setHeader("content-type", "text/csv");
  res.setHeader("content-disposition", `attachment; filename="${req.query.type ?? "alerts"}.csv"`);
  return res.send([header, ...rows].join("\n"));
}));

export default router;
