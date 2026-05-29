import { useState } from "react";
import { Button } from "../components/ui/Button";

const tabs = ["Thresholds", "Alerts", "Staff", "Shifts", "Wards", "System"] as const;
type Tab = (typeof tabs)[number];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("Thresholds");
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5"><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-medical-muted">Clinical thresholds, escalation policy, staff, shifts, wards, and system controls.</p></div>
      <div className="mb-4 flex gap-2 overflow-x-auto">{tabs.map((item) => <button className={`focusable rounded-md px-3 py-2 text-sm font-semibold ${tab === item ? "bg-medical-blue text-white" : "border border-medical-border bg-white dark:border-zinc-700 dark:bg-zinc-900"}`} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
      <section className="card p-5">
        {tab === "Thresholds" && <div className="grid gap-5 md:grid-cols-2"><Slider label="Occlusion EMA alpha" value="0.02" /><Slider label="Bubble threshold percent" value="85%" /><Slider label="DPM window size" value="10 seconds" /><Slider label="Trend limit" value="3 windows" /></div>}
        {tab === "Alerts" && <div className="grid gap-5 md:grid-cols-2"><Slider label="Warn after" value="2 minutes" /><Slider label="Escalate after" value="5 minutes" /><Toggle label="Audio alerts" /><Toggle label="Push notifications" /></div>}
        {tab === "Staff" && <Form title="Staff administration" fields={["Invite email", "Role", "Ward assignments"]} />}
        {tab === "Shifts" && <Form title="Shift schedule" fields={["Morning start", "Evening start", "Night start", "Auto-assignment rule"]} />}
        {tab === "Wards" && <Form title="Ward management" fields={["Ward name", "Type", "Floor", "Bed count"]} />}
        {tab === "System" && <Form title="System settings" fields={["Hospital name", "Logo URL", "Timezone", "Dark mode default"]} />}
      </section>
    </div>
  );
}

const Slider = ({ label, value }: { label: string; value: string }) => <label className="block"><div className="flex justify-between text-sm font-semibold"><span>{label}</span><span className="mono text-medical-muted">{value}</span></div><input className="mt-3 w-full accent-medical-blue" type="range" /></label>;
const Toggle = ({ label }: { label: string }) => <label className="flex items-center justify-between rounded-lg border border-medical-border p-4 dark:border-zinc-800"><span className="font-semibold">{label}</span><input type="checkbox" className="h-5 w-5 accent-medical-blue" defaultChecked /></label>;
const Form = ({ title, fields }: { title: string; fields: string[] }) => <div><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{fields.map((field) => <input key={field} className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder={field} />)}</div><Button className="mt-4" variant="primary">Save changes</Button></div>;
