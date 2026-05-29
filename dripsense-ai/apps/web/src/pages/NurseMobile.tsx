import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, Camera, UserRound, Users } from "lucide-react";
import { api } from "../services/api";
import { Badge } from "../components/ui/Badge";
import { asNumber } from "../utils/format";

export default function NurseMobile() {
  const patients = useQuery({ queryKey: ["patients", "mobile"], queryFn: () => api.patients() });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: api.alerts });
  return (
    <div className="mx-auto min-h-screen max-w-[390px] bg-zinc-950 pb-20 text-zinc-50 md:my-6 md:rounded-lg md:border md:border-zinc-800">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Night shift</div>
        <h1 className="text-xl font-bold">Nurse Mobile</h1>
      </header>
      <main className="space-y-3 p-3">
        {(alerts.data?.data ?? []).slice(0, 2).map((alert) => <div className="rounded-lg border border-red-900 bg-red-950/40 p-3" key={alert.id}><div className="flex items-center gap-2 font-semibold text-red-200"><AlertTriangle className="h-4 w-4" /> {alert.type.replaceAll("_", " ")}</div><p className="mt-1 text-sm text-zinc-300">{alert.patient_name}: {alert.message}</p></div>)}
        {(patients.data?.data ?? []).map((patient) => (
          <article key={patient.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-start justify-between"><div><h2 className="font-semibold">{patient.name}</h2><p className="text-xs text-zinc-400">{patient.room_number} / {patient.bed_number} · {patient.fluid_type}</p></div><Badge tone={patient.bubble_alarm ? "purple" : patient.is_online ? "green" : "gray"}>{patient.bubble_alarm ? "Bubble" : patient.is_online ? "Stable" : "Offline"}</Badge></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Metric label="DPM" value={Math.round(asNumber(patient.dpm))} /><Metric label="Flow" value={Math.round(asNumber(patient.flow_rate_ml_hr))} /><Metric label="Risk" value={Math.round(asNumber(patient.risk_score))} /></div>
          </article>
        ))}
      </main>
      <nav className="fixed bottom-0 left-1/2 grid w-full max-w-[390px] -translate-x-1/2 grid-cols-4 border-t border-zinc-800 bg-zinc-950 p-2">
        {[["Patients", Users], ["Alerts", Bell], ["Scan", Camera], ["Profile", UserRound]].map(([label, Icon]) => {
          const I = Icon as typeof Users;
          return <button key={String(label)} className="focusable grid place-items-center gap-1 rounded-md py-2 text-xs text-zinc-300"><I className="h-5 w-5" />{String(label)}</button>;
        })}
      </nav>
    </div>
  );
}

const Metric = ({ label, value }: { label: string; value: number }) => <div className="rounded-md bg-zinc-950 p-2"><div className="mono text-lg font-bold">{value}</div><div className="text-[11px] text-zinc-500">{label}</div></div>;
