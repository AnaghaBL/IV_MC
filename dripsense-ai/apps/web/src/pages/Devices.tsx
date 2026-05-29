import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Cpu, Plus, Wrench } from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import type { DeviceRecord } from "../types/domain";
import { timeAgo } from "../utils/format";

export default function Devices() {
  const [diagnostics, setDiagnostics] = useState<DeviceRecord | null>(null);
  const devices = useQuery({ queryKey: ["devices"], queryFn: api.devices });
  const command = useMutation({ mutationFn: ({ id, cmd }: { id: string; cmd: string }) => api.command(id, cmd) });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-2xl font-bold">Device Management</h1><p className="text-sm text-medical-muted">ESP32-CAM modules, bubble detectors, firmware, diagnostics, and commands.</p></div>
        <Button variant="primary"><Plus className="h-4 w-4" /> Register Device</Button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-medical-muted dark:bg-zinc-900">
              <tr>{["Device ID", "Type", "Assigned bed", "IP", "Firmware", "RSSI", "Battery", "Last seen", "Status", "Actions"].map((h) => <th className="px-4 py-3" key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(devices.data?.data ?? []).map((device) => (
                <tr key={device.id} className="border-t border-medical-border dark:border-zinc-800">
                  <td className="mono px-4 py-3">{device.mac_address}</td>
                  <td className="px-4 py-3">{device.device_type.replace("_", " ")}</td>
                  <td className="px-4 py-3">{device.room_number ?? "-"} / {device.bed_number ?? "-"}</td>
                  <td className="px-4 py-3">{device.ip_address ?? "-"}</td>
                  <td className="px-4 py-3">{device.firmware_version}</td>
                  <td className="mono px-4 py-3">{device.wifi_rssi ?? "-"} dBm</td>
                  <td className="mono px-4 py-3">{device.battery_level ?? "-"}%</td>
                  <td className="px-4 py-3">{timeAgo(device.last_seen)}</td>
                  <td className="px-4 py-3"><Badge tone={device.is_online ? "green" : "gray"}>{device.is_online ? "Online" : "Offline"}</Badge></td>
                  <td className="px-4 py-3"><div className="flex gap-2"><Button onClick={() => command.mutate({ id: device.id, cmd: "reboot" })}><Wrench className="h-4 w-4" /></Button><Button onClick={() => setDiagnostics(device)}><Activity className="h-4 w-4" /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {diagnostics && (
        <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md border-l border-medical-border bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Diagnostics</h2><Button onClick={() => setDiagnostics(null)}>Close</Button></div>
          <div className="mt-5 grid gap-3">
            <Diagnostic label="Raw sensor stream" value="Live values available after telemetry POST" />
            <Diagnostic label="Connection log" value={`Last seen ${timeAgo(diagnostics.last_seen)}`} />
            <Diagnostic label="Memory / CPU" value="ESP32 diagnostics endpoint pending firmware v1.5" />
            <Diagnostic label="Firmware update" value="Tracked: current channel stable" />
          </div>
        </aside>
      )}
    </div>
  );
}

const Diagnostic = ({ label, value }: { label: string; value: string }) => <div className="rounded-lg border border-medical-border p-4 dark:border-zinc-800"><div className="flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4" /> {label}</div><p className="mt-2 text-sm text-medical-muted">{value}</p></div>;
