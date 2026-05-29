import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, Search, Send, Stethoscope } from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import type { PatientCardRecord } from "../types/domain";
import { asNumber, timeAgo } from "../utils/format";

const filenameFor = (patient: PatientCardRecord) =>
  `${patient.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "patient"}-iv-report.pdf`;

export default function Reports() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const patients = useQuery({ queryKey: ["report-patients", search], queryFn: () => api.patients(search ? `?search=${encodeURIComponent(search)}` : "") });
  const patientList = patients.data?.data ?? [];
  const selectedPatient = useMemo(() => patientList.find((patient) => patient.id === selectedId) ?? patientList[0], [patientList, selectedId]);
  const downloadReport = useMutation({
    mutationFn: async (patient: PatientCardRecord) => api.downloadPatientReport(patient.id, filenameFor(patient))
  });
  const sendReport = useMutation({
    mutationFn: async ({ patient, target }: { patient: PatientCardRecord; target: "doctor" | "contact" | "both" }) => api.sendPatientReport(patient.id, target)
  });

  const handleDownload = () => {
    if (selectedPatient) downloadReport.mutate(selectedPatient);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctor Reports</h1>
          <p className="text-sm text-medical-muted">Generate a patient IV report that can be downloaded and sent to the treating doctor.</p>
        </div>
        <Button variant="primary" onClick={handleDownload} disabled={!selectedPatient || downloadReport.isPending}>
          <Download className="h-4 w-4" /> {downloadReport.isPending ? "Generating..." : "Download PDF report"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="border-b border-medical-border p-4 dark:border-zinc-800">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-medical-muted" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="focusable h-10 w-full rounded-md border border-medical-border pl-9 pr-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="Search patient or MRN" />
            </label>
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            {patients.isLoading && <div className="p-4 text-sm text-medical-muted">Loading patients...</div>}
            {patients.isError && <div className="p-4 text-sm text-medical-red">Unable to load patients.</div>}
            {!patients.isLoading && !patientList.length && <div className="p-4 text-sm text-medical-muted">No patients found.</div>}
            {patientList.map((patient) => (
              <button
                key={patient.id}
                className={`focusable block w-full border-b border-medical-border p-4 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${selectedPatient?.id === patient.id ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                onClick={() => setSelectedId(patient.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{patient.name}</div>
                    <div className="truncate text-xs text-medical-muted">{patient.mrn} | {patient.ward_name} | Room {patient.room_number}</div>
                  </div>
                  <Badge tone={patient.bubble_alarm ? "purple" : asNumber(patient.dpm) <= 20 ? "amber" : "green"}>{patient.bubble_alarm ? "Alarm" : asNumber(patient.dpm) <= 20 ? "Review" : "Stable"}</Badge>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="card p-5">
          {!selectedPatient ? (
            <div className="grid min-h-[420px] place-items-center text-center text-medical-muted">
              <div>
                <FileText className="mx-auto h-10 w-10" />
                <div className="mt-3 font-semibold">Select a patient to preview report details.</div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-3 border-b border-medical-border pb-4 dark:border-zinc-800 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-lg font-bold"><Stethoscope className="h-5 w-5 text-medical-blue" /> {selectedPatient.name}</div>
                  <div className="mt-1 text-sm text-medical-muted">{selectedPatient.mrn} | {selectedPatient.age} yrs, {selectedPatient.gender}</div>
                </div>
                <Badge tone={selectedPatient.is_online ? "green" : "gray"}>{selectedPatient.is_online ? "Device online" : "Device offline"}</Badge>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ReportMetric label="Ward / Room" value={`${selectedPatient.ward_name} ${selectedPatient.room_number}`} />
                <ReportMetric label="Diagnosis" value={selectedPatient.diagnosis} />
                <ReportMetric label="Current DPM" value={Math.round(asNumber(selectedPatient.dpm))} />
                <ReportMetric label="Flow" value={`${Math.round(asNumber(selectedPatient.flow_rate_ml_hr))} ml/hr`} />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-medical-border p-4 dark:border-zinc-800">
                  <div className="font-semibold">Care team</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Attending doctor</span><span className="font-semibold">{selectedPatient.attending_doctor ?? "Unassigned"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Doctor email</span><span className="font-semibold">{selectedPatient.attending_doctor_email ?? "Not configured"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Primary nurse</span><span className="font-semibold">{selectedPatient.primary_nurse ?? "Unassigned"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Fluid</span><span className="font-semibold">{selectedPatient.fluid_type ?? "No active IV"}</span></div>
                  </div>
                </div>
                <div className="rounded-md border border-medical-border p-4 dark:border-zinc-800">
                  <div className="font-semibold">Device snapshot</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">ESP32-CAM IP</span><span className="font-semibold">{selectedPatient.ip_address ?? "Not configured"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">WiFi</span><span className="font-semibold">{selectedPatient.wifi_rssi ?? "offline"} dBm</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Last telemetry</span><span className="font-semibold">{timeAgo(selectedPatient.last_telemetry_at)}</span></div>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-medical-border p-4 dark:border-zinc-800">
                  <div className="font-semibold">Patient first contact</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Name</span><span className="font-semibold">{selectedPatient.first_contact_name ?? "Not configured"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Email</span><span className="font-semibold">{selectedPatient.first_contact_email ?? "Not configured"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Phone</span><span className="font-semibold">{selectedPatient.first_contact_phone ?? "Not configured"}</span></div>
                  </div>
                </div>
                <div className="rounded-md border border-medical-border p-4 dark:border-zinc-800">
                  <div className="font-semibold">Clinical report sections</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Allergies</span><span className="font-semibold">{selectedPatient.allergies ?? "Included in PDF"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Previous results</span><span className="font-semibold">{selectedPatient.previous_results ?? "Included in PDF"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-medical-muted">Prescriptions</span><span className="font-semibold">{selectedPatient.prescriptions ?? "Included in PDF"}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100">
                <div className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4" /> Report includes</div>
                <p className="mt-2">Patient history, allergies, previous hospital results, diagnosis, prescriptions, current IV telemetry, device status, and alert timeline.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => sendReport.mutate({ patient: selectedPatient, target: "doctor" })} disabled={sendReport.isPending}>Send to doctor</Button>
                  <Button onClick={() => sendReport.mutate({ patient: selectedPatient, target: "contact" })} disabled={sendReport.isPending}>Send to first contact</Button>
                  <Button onClick={() => sendReport.mutate({ patient: selectedPatient, target: "both" })} disabled={sendReport.isPending}>Send to both</Button>
                </div>
              </div>
              {downloadReport.isError && <p className="mt-3 text-sm font-semibold text-medical-red">Report download failed. Check that the API server is running.</p>}
              {downloadReport.isSuccess && <p className="mt-3 text-sm font-semibold text-medical-blue">PDF report downloaded.</p>}
              {sendReport.isError && <p className="mt-3 text-sm font-semibold text-medical-red">Sending failed. Check that the API server is running.</p>}
              {sendReport.isSuccess && <p className="mt-3 text-sm font-semibold text-medical-blue">Report queued for {sendReport.data.recipients.map((recipient) => `${recipient.name} (${recipient.destination})`).join(", ")}.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const ReportMetric = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-md border border-medical-border p-4 dark:border-zinc-800">
    <div className="text-xs font-semibold uppercase tracking-wide text-medical-muted">{label}</div>
    <div className="mt-2 break-words text-lg font-bold">{value}</div>
  </div>
);
