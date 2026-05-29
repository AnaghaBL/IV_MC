import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Droplets, Gauge, HeartPulse, Search, Wifi } from "lucide-react";
import { api } from "../services/api";
import { PatientCard } from "../components/patient/PatientCard";
import { Badge } from "../components/ui/Badge";
import { asNumber } from "../utils/format";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const patients = useQuery({ queryKey: ["patients", search], queryFn: () => api.patients(search ? `?search=${encodeURIComponent(search)}` : "") });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: api.alerts });
  const data = patients.data?.data ?? [];
  const summary = useMemo(() => {
    const critical = alerts.data?.data.filter((alert) => alert.severity === "CRITICAL").length ?? 0;
    const bubbles = alerts.data?.data.filter((alert) => alert.type === "AIR_BUBBLE").length ?? 0;
    const online = data.filter((patient) => patient.is_online).length;
    const avg = data.length ? Math.round(data.reduce((sum, patient) => sum + asNumber(patient.flow_rate_ml_hr), 0) / data.length) : 0;
    return [
      { label: "Total Active Patients", value: data.length, icon: HeartPulse },
      { label: "Critical Alerts", value: critical, icon: AlertTriangle },
      { label: "Air Bubble Detections", value: bubbles, icon: Droplets },
      { label: "Devices Online", value: online, icon: Wifi },
      { label: "Avg Flow Rate", value: `${avg} ml/hr`, icon: Gauge }
    ];
  }, [alerts.data?.data, data]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Central Hospital Dashboard</h1>
          <p className="text-sm text-medical-muted">Live ward telemetry, predictive risk, and infusion safety state.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", "Stable", "Attention", "Critical", "Offline"].map((status) => <Badge key={status}>{status}</Badge>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summary.map(({ label, value, icon: Icon }) => (
          <div className="card p-4" key={label}>
            <div className="flex items-center justify-between text-medical-muted"><span className="text-xs font-semibold uppercase tracking-wide">{label}</span><Icon className="h-4 w-4" /></div>
            <div className="mono mt-3 text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>
      <div className="card my-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <div className="text-sm font-semibold">Active alert banner</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(alerts.data?.data.slice(0, 3) ?? []).map((alert) => <Badge key={alert.id} tone={alert.severity === "CRITICAL" ? "red" : alert.severity === "WARNING" ? "amber" : "blue"}>{alert.patient_name}: {alert.type.replaceAll("_", " ")}</Badge>)}
              {!alerts.data?.data.length && <span className="text-sm text-medical-muted">No unacknowledged alerts.</span>}
            </div>
          </div>
          <label className="relative block min-w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-medical-muted" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="focusable h-10 w-full rounded-md border border-medical-border pl-9 pr-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="Search name or MRN" />
          </label>
          <select className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950"><option>Sort by severity</option><option>Name</option><option>Room</option><option>Flow rate</option></select>
        </div>
      </div>
      {patients.isLoading && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card h-56 animate-pulse bg-zinc-100 dark:bg-zinc-900" />)}</div>}
      {patients.isError && <div className="card p-6 text-medical-red">Unable to load patient telemetry.</div>}
      {!patients.isLoading && !data.length && <div className="card p-6 text-medical-muted">No active patients match this filter.</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.map((patient) => <PatientCard key={patient.id} patient={patient} />)}
      </div>
    </div>
  );
}
