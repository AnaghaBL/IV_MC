export type StaffRole = "NURSE" | "DOCTOR" | "ADMIN" | "BIOMEDICAL";
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertType =
  | "OCCLUSION_PREDICTED"
  | "NO_DRIP"
  | "RAPID_FLOW"
  | "AIR_BUBBLE"
  | "IV_COMPLETE"
  | "DEVICE_OFFLINE"
  | "LOW_BATTERY";

export interface AuthStaff {
  id: string;
  hospitalId: string;
  email: string;
  name: string;
  role: StaffRole;
}

export interface SocketTelemetry {
  patientId: string;
  sessionId: string;
  dpm: number;
  flowRate: number;
  bubbleAlarm: boolean;
  timestamp: string;
}
