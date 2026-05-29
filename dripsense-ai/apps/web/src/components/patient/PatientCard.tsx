import { Link } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Sparkline } from "../charts/MiniCharts";
import type { PatientCardRecord, PatientStatus } from "../../types/domain";
import { asNumber, completionEstimate, timeAgo } from "../../utils/format";

const statusFor = (patient: PatientCardRecord): PatientStatus => {
  if (!patient.is_online) return "DEVICE_OFFLINE";
  if (patient.bubble_alarm) return "AIR_BUBBLE";
  const risk = asNumber(patient.risk_score);
  const dpm = asNumber(patient.dpm);
  if (risk >= 90) return "CRITICAL";
  if (dpm < 35) return "REDUCED_FLOW";
  if (risk >= 50) return "ATTENTION";
  return "STABLE";
};

const styles: Record<PatientStatus, string> = {
  STABLE: "border-l-medical-green",
  ATTENTION: "border-l-medical-amber bg-medical-amber-light/40 dark:bg-yellow-950/10",
  REDUCED_FLOW: "border-l-medical-orange",
  CRITICAL: "border-l-medical-red bg-medical-red-light/60 animate-critical dark:bg-red-950/10",
  AIR_BUBBLE: "border-l-medical-purple",
  DEVICE_OFFLINE: "border-l-zinc-400 opacity-70"
};

export const PatientCard = ({ patient }: { patient: PatientCardRecord }) => {
  const status = statusFor(patient);
  const dpm = asNumber(patient.dpm);
  const flow = asNumber(patient.flow_rate_ml_hr);
  const risk = asNumber(patient.risk_score);
  const spark = Array.from({ length: 10 }, (_, index) => Math.max(0, dpm + Math.sin(index) * 5 - index * (status === "REDUCED_FLOW" ? 1 : 0)));

  return (
    <Link to={`/patients/${patient.id}`} className={`card focusable block border-l-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${styles[status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`truncate text-sm font-semibold ${status === "DEVICE_OFFLINE" ? "line-through" : ""}`}>{patient.name}</h3>
          <p className="truncate text-xs text-medical-muted">{patient.mrn} | Room {patient.room_number} / {patient.bed_number}</p>
        </div>
        <Badge tone={status === "CRITICAL" ? "red" : status === "AIR_BUBBLE" ? "purple" : status === "ATTENTION" ? "amber" : status === "REDUCED_FLOW" ? "orange" : status === "STABLE" ? "green" : "gray"}>{status.replace("_", " ")}</Badge>
      </div>
      <div className="mt-3 grid gap-1 rounded-md border border-medical-border bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="flex justify-between gap-3"><span className="text-medical-muted">Diagnosis</span><span className="truncate font-semibold">{patient.diagnosis}</span></div>
        <div className="flex justify-between gap-3"><span className="text-medical-muted">Age / Sex</span><span className="font-semibold">{patient.age} / {patient.gender}</span></div>
        <div className="flex justify-between gap-3"><span className="text-medical-muted">Doctor</span><span className="truncate font-semibold">{patient.attending_doctor ?? "Unassigned"}</span></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-medical-muted">Live DPM</div>
          <div className="mono text-2xl font-bold">{Math.round(dpm)}</div>
        </div>
        <div>
          <div className="text-xs text-medical-muted">Flow</div>
          <div className="mono text-2xl font-bold">{Math.round(flow)}<span className="text-xs font-medium text-medical-muted"> ml/hr</span></div>
        </div>
      </div>
      <div className="mt-3 h-[30px]"><Sparkline values={spark} /></div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-medical-muted"><span>{patient.fluid_type ?? "No active IV"}</span><span>{completionEstimate(patient.volume_ml, patient.rate_ml_hr)}</span></div>
        <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-2 rounded-full bg-medical-blue transition-all" style={{ width: `${Math.max(12, 100 - risk)}%` }} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-medical-muted">
        <span className="flex items-center gap-1">{patient.is_online ? <Wifi className="h-4 w-4 text-medical-green" /> : <WifiOff className="h-4 w-4" />} {patient.wifi_rssi ?? "offline"} dBm</span>
        <span className={patient.bubble_alarm ? "font-semibold text-medical-purple" : ""}>{patient.bubble_alarm ? "Bubble active" : "Bubble clear"}</span>
        <span>{timeAgo(patient.last_telemetry_at)}</span>
      </div>
    </Link>
  );
};
