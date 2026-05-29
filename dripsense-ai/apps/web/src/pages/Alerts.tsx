import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Download, Volume2 } from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import type { AlertRecord } from "../types/domain";
import { timeAgo } from "../utils/format";

export default function Alerts() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AlertRecord | null>(null);
  const active = useQuery({ queryKey: ["alerts"], queryFn: api.alerts });
  const log = useQuery({ queryKey: ["alert-log"], queryFn: api.alertLog });
  const acknowledge = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["alert-log"] });
    }
  });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-2xl font-bold">Alerts Center</h1><p className="text-sm text-medical-muted">Escalation, acknowledgement, and historical response log.</p></div>
        <div className="flex gap-2"><Button><Volume2 className="h-4 w-4" /> Audio on</Button><Button><Download className="h-4 w-4" /> Export CSV</Button></div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">{["All types", "ICU", "Critical", "Warning", "Today"].map((filter) => <Badge key={filter}>{filter}</Badge>)}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="border-b border-medical-border p-4 font-semibold dark:border-zinc-800">Active unacknowledged</div>
          <div className="divide-y divide-medical-border dark:divide-zinc-800">
            {(active.data?.data ?? []).map((alert) => (
              <article key={alert.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="font-semibold">{alert.patient_name ?? "Patient"} · Room {alert.room_number}</div><p className="mt-1 text-sm text-medical-muted">{alert.message}</p></div>
                  <Badge tone={alert.severity === "CRITICAL" ? "red" : alert.severity === "WARNING" ? "amber" : "blue"}>{alert.severity}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm"><span className="text-medical-muted">Escalated to Level {alert.escalation_level} · {timeAgo(alert.triggered_at)}</span><Button variant="primary" onClick={() => setSelected(alert)}>Acknowledge</Button></div>
              </article>
            ))}
            {!active.data?.data.length && <div className="p-6 text-sm text-medical-muted">No active alerts.</div>}
          </div>
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-medical-border p-4 font-semibold dark:border-zinc-800">Alert history log</div>
          <div className="max-h-[640px] overflow-auto">
            {(log.data?.data ?? []).map((alert) => (
              <div key={alert.id} className="flex gap-3 border-b border-medical-border p-4 text-sm dark:border-zinc-800">
                <BellRing className="h-4 w-4 text-medical-muted" />
                <div><div className="font-semibold">{alert.type.replaceAll("_", " ")} · {alert.severity}</div><div className="text-medical-muted">{alert.message}</div></div>
                <span className="ml-auto whitespace-nowrap text-medical-muted">{timeAgo(alert.triggered_at)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold">Acknowledge alert</h2>
            <p className="mt-2 text-sm text-medical-muted">{selected.message}</p>
            <textarea className="focusable mt-4 min-h-24 w-full rounded-md border border-medical-border p-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="Optional response note" />
            <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setSelected(null)}>Cancel</Button><Button variant="primary" onClick={() => acknowledge.mutate(selected.id)}>Confirm</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
