import { useQuery } from "@tanstack/react-query";
import { BarPanel, DonutPanel, LinePanel, ScatterPanel } from "../components/charts/MiniCharts";
import { api } from "../services/api";

export default function Analytics() {
  const alerts = useQuery({ queryKey: ["analytics", "alert-trends"], queryFn: () => api.analytics("alert-trends") });
  const uptime = useQuery({ queryKey: ["analytics", "device-uptime"], queryFn: () => api.analytics("device-uptime") });
  const stats = useQuery({ queryKey: ["analytics", "infusion-stats"], queryFn: () => api.analytics("infusion-stats") });
  const alertData = (alerts.data?.data ?? []).slice(-7).map((row, index) => ({ name: `D${index + 1}`, value: Number(row.count ?? 0), secondary: index % 3 }));
  const uptimeData = (uptime.data?.data ?? []).map((row) => ({ name: String(row.mac_address ?? "Device").slice(-5), value: row.is_online ? 98 : 62 }));
  const infusionData = (stats.data?.data ?? []).map((row) => ({ name: String(row.status), value: Number(row.count ?? 0) }));

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h1 className="text-2xl font-bold">AI Analytics</h1><p className="text-sm text-medical-muted">Prediction quality, response time, flow consistency, and device reliability.</p></div>
        <div className="flex gap-2"><input type="date" className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" /><select className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950"><option>All wards</option></select></div>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {["3 occlusions predicted this week, 2 confirmed. Model accuracy 67%.", "Average acknowledgement time is 2m 18s across critical alerts.", "Device uptime is strongest in ICU after AP relocation."].map((text) => <div className="card p-4 text-sm font-medium" key={text}>{text}</div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Occlusion Predictions Over Time"><LinePanel data={alertData.length ? alertData : fallbackLine} /></Panel>
        <Panel title="Alert Type Distribution"><DonutPanel data={infusionData.length ? infusionData : fallbackDonut} /></Panel>
        <Panel title="Average Response Time by Nurse"><BarPanel data={[{ name: "N1", value: 138 }, { name: "N2", value: 174 }, { name: "N3", value: 95 }]} /></Panel>
        <Panel title="DPM Consistency Score by Patient"><ScatterPanel data={[{ name: "P1", value: 62, secondary: 91 }, { name: "P2", value: 48, secondary: 72 }, { name: "P3", value: 77, secondary: 96 }]} /></Panel>
        <Panel title="Device Uptime"><BarPanel data={uptimeData.length ? uptimeData : fallbackUptime} /></Panel>
        <Panel title="Infusion Completion Rate"><DonutPanel data={infusionData.length ? infusionData : fallbackInfusion} /></Panel>
      </div>
    </div>
  );
}

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="card p-5"><h2 className="mb-4 font-semibold">{title}</h2>{children}</section>;
const fallbackLine = [{ name: "Mon", value: 1, secondary: 0 }, { name: "Tue", value: 2, secondary: 1 }, { name: "Wed", value: 3, secondary: 1 }];
const fallbackDonut = [{ name: "Predicted", value: 3 }, { name: "Actual", value: 2 }, { name: "Resolved", value: 9 }];
const fallbackUptime = [{ name: "D01", value: 98 }, { name: "D02", value: 93 }, { name: "D03", value: 88 }];
const fallbackInfusion = [{ name: "Completed", value: 72 }, { name: "Interrupted", value: 8 }, { name: "Alarmed", value: 20 }];
