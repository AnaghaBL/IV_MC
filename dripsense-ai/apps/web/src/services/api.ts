import type { AlertRecord, DeviceRecord, PatientCardRecord, Staff, TelemetryPoint } from "../types/domain";

const API_URL = import.meta.env.VITE_API_URL || "";

export interface AuthResponse {
  accessToken: string;
  staff: Staff;
}

export interface ListResponse<T> {
  data: T[];
}

let accessToken: string | null = localStorage.getItem("dripsense.accessToken");

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) localStorage.setItem("dripsense.accessToken", token);
  else localStorage.removeItem("dripsense.accessToken");
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "Network error" }))) as { error?: string };
    throw new Error(body.error ?? "Network error");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

export const api = {
  login: (payload: { email: string; password: string; remember?: boolean }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  refresh: () => request<AuthResponse>("/api/auth/refresh", { method: "POST" }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  patients: (query = "") => request<ListResponse<PatientCardRecord>>(`/api/patients${query}`),
  patient: (id: string) => request<Record<string, unknown>>(`/api/patients/${id}`),
  patientHistory: (id: string) => request<ListResponse<Record<string, unknown>>>(`/api/patients/${id}/history`),
  patientAlerts: (id: string) => request<ListResponse<AlertRecord>>(`/api/patients/${id}/alerts`),
  telemetry: (sessionId: string) => request<ListResponse<TelemetryPoint>>(`/api/telemetry/${sessionId}`),
  alerts: () => request<ListResponse<AlertRecord>>("/api/alerts"),
  alertLog: () => request<ListResponse<AlertRecord>>("/api/alerts/log"),
  acknowledgeAlert: (id: string, note?: string) => request<AlertRecord>(`/api/alerts/${id}/acknowledge`, { method: "PATCH", body: JSON.stringify({ note }) }),
  resolveAlert: (id: string) => request<AlertRecord>(`/api/alerts/${id}/resolve`, { method: "PATCH" }),
  devices: () => request<ListResponse<DeviceRecord>>("/api/devices"),
  analytics: (name: "ward-summary" | "alert-trends" | "device-uptime" | "infusion-stats") =>
    request<ListResponse<Record<string, unknown>>>(`/api/analytics/${name}`),
  command: (id: string, command: string) => request<{ queued: boolean; command: string }>(`/api/devices/${id}/command`, { method: "POST", body: JSON.stringify({ command }) })
};
