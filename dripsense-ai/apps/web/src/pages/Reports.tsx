import { Download, FileText } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function Reports() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5"><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-medical-muted">Patient infusion PDFs, shift summaries, alert logs, and incident timelines.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Patient infusion report" fields={["Select patient", "Date range"]} action="Generate PDF" />
        <ReportCard title="Shift report" fields={["Select ward", "Shift"]} action="PDF / CSV" />
        <ReportCard title="Alert response log" fields={["Date range", "Severity"]} action="Export CSV" />
        <ReportCard title="Incident summary" fields={["Patient", "Session"]} action="Structured PDF" />
      </div>
    </div>
  );
}

const ReportCard = ({ title, fields, action }: { title: string; fields: string[]; action: string }) => (
  <section className="card p-5">
    <div className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-medical-blue" /> {title}</div>
    <div className="mt-4 grid gap-3">
      {fields.map((field) => <input key={field} className="focusable h-10 rounded-md border border-medical-border px-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder={field} />)}
    </div>
    <Button className="mt-4" variant="primary"><Download className="h-4 w-4" /> {action}</Button>
  </section>
);
