import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, Expand, FileImage, PictureInPicture2, RotateCw, Siren } from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { DpmAreaChart } from "../components/charts/MiniCharts";
import { asNumber, timeAgo } from "../utils/format";

const tabs = ["Monitor", "History", "Alerts", "Device", "Notes"] as const;
type Tab = (typeof tabs)[number];

const textField = (record: Record<string, unknown> | undefined, key: string, fallback = "Unknown") => {
  const value = record?.[key];
  return typeof value === "string" ? value : fallback;
};

const recordField = (record: Record<string, unknown> | undefined, key: string) => {
  const value = record?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
};

const numberField = (record: Record<string, unknown> | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? value : null;
};

export default function PatientDetail() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<Tab>("Monitor");
  const [streamFailed, setStreamFailed] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [note, setNote] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState("");
  const monitorRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const patient = useQuery({ queryKey: ["patient", id], queryFn: () => api.patient(id), enabled: Boolean(id), refetchInterval: 3000 });
  const history = useQuery({ queryKey: ["patient-history", id], queryFn: () => api.patientHistory(id), enabled: Boolean(id) });
  const alerts = useQuery({ queryKey: ["patient-alerts", id], queryFn: () => api.patientAlerts(id), enabled: Boolean(id) });
  const session = recordField(patient.data, "active_session");
  const device = recordField(patient.data, "device");
  const latest = recordField(patient.data, "latest_telemetry");
  const sessionId = textField(session, "id", "");
  const telemetry = useQuery({ queryKey: ["telemetry", sessionId], queryFn: () => api.telemetry(sessionId), enabled: Boolean(sessionId), refetchInterval: 3000 });
  const streamUrl = useMemo(() => {
    const ip = textField(device, "ip_address", "");
    return ip ? `http://${ip}/stream` : "";
  }, [device]);
  const telemetryPoints = telemetry.data?.data ?? [];
  const latestSensorPoint = [...telemetryPoints].reverse().find((point) => point.raw_sensor !== null && point.raw_sensor !== undefined);
  const latestDpm = Math.round(asNumber(numberField(latest, "dpm")));
  const latestFlow = Math.round(asNumber(numberField(latest, "flow_rate_ml_hr")));
  const latestRaw = latestSensorPoint?.raw_sensor ?? numberField(latest, "raw_sensor");
  const latestBaseline = latestSensorPoint?.baseline_sensor ?? numberField(latest, "baseline_sensor");
  const airLineAlarm = Boolean(latestSensorPoint?.alarm_active ?? latest?.alarm_active);
  const deviceId = textField(device, "id", "");
  const deviceCommand = useMutation({
    mutationFn: (command: string) => api.command(deviceId, command),
    onSuccess: (result) => setActionMessage(`${result.command} queued`),
    onError: () => setActionMessage("Device command failed")
  });

  const requestFullscreen = async () => {
    if (!monitorRef.current) return;
    await monitorRef.current.requestFullscreen().catch(() => setActionMessage("Fullscreen is blocked by this browser"));
  };

  const takeSnapshot = () => {
    const image = imageRef.current;
    if (!image) {
      setActionMessage("No camera frame available");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.clientWidth;
      canvas.height = image.naturalHeight || image.clientHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.download = `${textField(patient.data, "name", "patient").replaceAll(" ", "-").toLowerCase()}-iv-snapshot.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
      setActionMessage("Snapshot downloaded");
    } catch {
      setActionMessage("Snapshot blocked by camera stream permissions");
    }
  };

  const openPip = async () => {
    const browserWindow = window as Window & {
      documentPictureInPicture?: { requestWindow: (options?: { width?: number; height?: number }) => Promise<Window> };
    };

    try {
      if (browserWindow.documentPictureInPicture && monitorRef.current) {
        const pipWindow = await browserWindow.documentPictureInPicture.requestWindow({ width: 420, height: 280 });
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.background = "#09090b";
        const image = pipWindow.document.createElement("img");
        image.src = streamUrl;
        image.alt = "IV monitor picture-in-picture";
        image.style.width = "100%";
        image.style.height = "100vh";
        image.style.objectFit = "contain";
        pipWindow.document.body.append(image);
        setActionMessage("PiP opened");
        return;
      }

      const popup = window.open(streamUrl, "dripsense-pip", "width=420,height=320,popup=yes");
      setActionMessage(popup ? "PiP window opened" : "Popup blocked");
    } catch {
      setActionMessage("PiP is not supported by this browser");
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{textField(patient.data, "name", "Patient Detail")}</h1>
          <p className="text-sm text-medical-muted">{textField(patient.data, "mrn")} · {textField(patient.data, "diagnosis")}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((item) => <button key={item} className={`focusable rounded-md px-3 py-2 text-sm font-semibold ${tab === item ? "bg-medical-blue text-white" : "border border-medical-border bg-white dark:border-zinc-700 dark:bg-zinc-900"}`} onClick={() => setTab(item)}>{item}</button>)}
        </div>
      </div>

      {patient.isLoading && <div className="card h-96 animate-pulse bg-zinc-100 dark:bg-zinc-900" />}
      {patient.isError && <div className="card p-6 text-medical-red">Patient detail unavailable.</div>}

      {tab === "Monitor" && patient.data && (
        <>
          {airLineAlarm && (
            <section className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm dark:bg-red-950/30 dark:text-red-100">
              <div className="flex items-center gap-2 text-lg font-bold"><Siren className="h-5 w-5" /> AIR EMBOLISM RISK DETECTED</div>
              <p className="mt-1 text-sm">Air-in-line sensor alarm is active. Check IV tubing and stop infusion according to protocol.</p>
            </section>
          )}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
            <section className="card overflow-hidden" ref={monitorRef}>
              <div className="relative aspect-video overflow-hidden bg-zinc-950">
                {streamUrl && !streamFailed ? (
                  <img
                    ref={imageRef}
                    src={streamUrl}
                    alt="ESP32-CAM live IV drip chamber stream"
                    crossOrigin="anonymous"
                    className="h-full w-full object-contain"
                    onError={() => setStreamFailed(true)}
                    onLoad={() => setStreamFailed(false)}
                  />
                ) : (
                  <div className="grid h-full place-items-center px-4 text-center text-zinc-300">
                    <div>
                      <Camera className="mx-auto h-10 w-10 text-zinc-500" />
                      <div className="mt-3 font-semibold">{streamUrl ? "Camera stream not reachable" : "No camera IP configured"}</div>
                      <div className="mt-1 text-sm text-zinc-500">{streamUrl || "Start backend with ESP32_CAM_IP"}</div>
                    </div>
                  </div>
                )}
                <OpenCvHud dpm={latestDpm} flow={latestFlow} telemetry={telemetryPoints} alarm={airLineAlarm} />
              </div>
              <div className="flex gap-2 border-t border-medical-border p-3 dark:border-zinc-800">
                <Button onClick={requestFullscreen}><Expand className="h-4 w-4" /> Fullscreen</Button>
                <Button onClick={takeSnapshot}><FileImage className="h-4 w-4" /> Snapshot</Button>
                <Button onClick={openPip} disabled={!streamUrl}><PictureInPicture2 className="h-4 w-4" /> PiP</Button>
              </div>
              {actionMessage && <p className="border-t border-medical-border px-3 pb-3 text-sm font-medium text-medical-blue dark:border-zinc-800">{actionMessage}</p>}
            </section>
            <aside className="card p-5">
              <div className="grid gap-4">
                <Metric label="Current DPM" value={latestDpm} />
                <Metric label="Flow rate" value={`${latestFlow} ml/hr`} />
                <Metric label="Air-line sensor" value={latestRaw === null ? "Waiting" : latestRaw} />
                <Metric label="Sensor baseline" value={latestBaseline === null ? "Waiting" : Number(latestBaseline).toFixed(1)} />
                <Metric label="Air embolism alert" value={airLineAlarm ? "ACTIVE" : "Clear"} />
                <Metric label="Volume remaining" value={`${session?.volume_ml ?? "N/A"} ml`} />
                <div>
                  <div className="text-sm font-semibold">Occlusion risk</div>
                  <div className="mt-2 grid place-items-center rounded-lg border border-medical-border py-6 dark:border-zinc-800">
                    <div className="mono grid h-28 w-28 place-items-center rounded-full border-8 border-medical-amber text-2xl font-bold">64</div>
                  </div>
                </div>
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/20">
                  <div className="flex items-center gap-2 font-semibold text-medical-purple"><Siren className="h-4 w-4" /> OCCLUSION IN ~14 mins</div>
                  <div className="mt-2 h-2 rounded-full bg-white dark:bg-zinc-800"><div className="h-2 w-4/5 rounded-full bg-medical-purple" /></div>
                </div>
              </div>
            </aside>
          </div>
          <section className="card mt-4 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">DPM Trend · Last readings</h2>
              <Badge tone="blue">{telemetry.data?.data.length ?? 0} samples</Badge>
            </div>
            {telemetry.isLoading && <div className="h-[260px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}
            {!telemetry.isLoading && (telemetry.data?.data.length ?? 0) === 0 && <div className="grid h-[260px] place-items-center rounded-lg border border-medical-border text-sm text-medical-muted dark:border-zinc-800">Waiting for telemetry samples</div>}
            {!telemetry.isLoading && (telemetry.data?.data.length ?? 0) > 0 && <DpmAreaChart data={telemetry.data?.data ?? []} />}
          </section>
        </>
      )}

      {tab === "History" && <Table title="Infusion Sessions" rows={history.data?.data ?? []} columns={["fluid_type", "volume_ml", "rate_ml_hr", "started_at", "completed_at", "status"]} />}
      {tab === "Alerts" && <Table title="Patient Alert Timeline" rows={(alerts.data?.data ?? []).map((alert) => ({ ...alert }))} columns={["type", "severity", "message", "triggered_at", "acknowledged_at", "escalation_level"]} />}
      {tab === "Device" && (
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Assigned ESP32 Devices</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Metric label="Device ID" value={textField(device, "id")} />
            <Metric label="IP stream" value={streamUrl || "Not configured"} />
            <Metric label="Firmware" value={textField(device, "firmware_version")} />
            <Metric label="Last seen" value={timeAgo(textField(device, "last_seen", ""))} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => deviceCommand.mutate("reboot")} disabled={!deviceId || deviceCommand.isPending}><RotateCw className="h-4 w-4" /> Reboot</Button>
            <Button onClick={() => deviceCommand.mutate("test-alert")} disabled={!deviceId || deviceCommand.isPending}>Test Alert</Button>
            <Button onClick={() => deviceCommand.mutate("recalibrate")} disabled={!deviceId || deviceCommand.isPending}>Recalibrate Sensor</Button>
          </div>
          {actionMessage && <p className="mt-3 text-sm font-medium text-medical-blue">{actionMessage}</p>}
        </section>
      )}
      {tab === "Notes" && (
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Nurse Notes</h2>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} className="focusable mt-4 min-h-32 w-full rounded-md border border-medical-border p-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="Document intervention or handoff note" />
          <Button className="mt-3" variant="primary" disabled={!note.trim()} onClick={() => setNoteSavedAt(new Date().toLocaleString())}>Submit note</Button>
          {noteSavedAt && <p className="mt-3 text-sm font-medium text-medical-blue">Note saved locally at {noteSavedAt}</p>}
        </section>
      )}
    </div>
  );
}

const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-medical-border p-4 dark:border-zinc-800">
    <div className="text-xs font-semibold uppercase tracking-wide text-medical-muted">{label}</div>
    <div className="mono mt-2 break-words text-2xl font-bold">{value}</div>
  </div>
);

const OpenCvHud = ({
  dpm,
  flow,
  telemetry,
  alarm
}: {
  dpm: number;
  flow: number;
  telemetry: Array<{ timestamp: string; dpm: string | number | null; flow_rate_ml_hr: string | number | null }>;
  alarm: boolean;
}) => {
  const values = telemetry.slice(-20).map((point) => asNumber(point.dpm));
  const recent = values.slice(-4);
  const trendDrops = recent.reduce((count, value, index, items) => {
    if (index === 0) return count;
    const previous = items[index - 1] ?? value;
    return value < previous * 0.98 ? count + 1 : count;
  }, 0);
  const status = alarm ? "AIR-IN-LINE ALARM" : trendDrops >= 3 ? "OCCLUSION IMMINENT" : dpm <= 0 ? "NO FLOW DETECTED" : "STABLE FLOW";
  const statusClass = alarm || trendDrops >= 3 || dpm <= 0 ? "text-red-400" : "text-green-400";
  const max = Math.max(80, ...values);
  const points = values
    .map((value, index) => {
      const x = 8 + index * 11;
      const y = 84 - (value / max) * 60;
      return `${x},${Math.max(12, y)}`;
    })
    .join(" ");

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-0 right-0 top-0 flex min-h-[86px] items-start justify-between bg-zinc-950/55 px-5 py-3 backdrop-blur-[1px]">
        <div>
          <div className="font-mono text-[clamp(18px,3vw,30px)] font-bold leading-none text-white">FLOW: {dpm.toFixed(1)} DPM</div>
          <div className={`mt-2 font-mono text-[clamp(18px,3vw,30px)] font-bold leading-none ${statusClass}`}>{status}</div>
          <div className="mt-1 font-mono text-xs text-zinc-400">RATE: {flow} ml/hr</div>
        </div>
        <div className="font-mono text-[clamp(14px,2vw,22px)] font-bold text-yellow-300">TREND: {Math.min(3, trendDrops)}/3</div>
      </div>
      <div className="absolute bottom-4 right-4 h-[116px] w-[240px] bg-zinc-950/65 p-3 backdrop-blur-[1px]">
        <div className="font-mono text-xs text-zinc-300">DPM TREND</div>
        <svg viewBox="0 0 232 88" className="mt-1 h-[80px] w-full">
          <line x1="0" y1="84" x2="232" y2="84" stroke="#3f3f46" strokeWidth="1" />
          {points ? <polyline points={points} fill="none" stroke="#facc15" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </svg>
      </div>
    </div>
  );
};

const Table = ({ title, rows, columns }: { title: string; rows: Record<string, unknown>[]; columns: string[] }) => (
  <section className="card overflow-hidden">
    <div className="border-b border-medical-border p-4 text-lg font-semibold dark:border-zinc-800">{title}</div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-medical-muted dark:bg-zinc-900">
          <tr>{columns.map((column) => <th className="px-4 py-3" key={column}>{column.replaceAll("_", " ")}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => <tr className="border-t border-medical-border dark:border-zinc-800" key={String(row.id ?? index)}>{columns.map((column) => <td className="px-4 py-3" key={column}>{String(row[column] ?? "-")}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  </section>
);
