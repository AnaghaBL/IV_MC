export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertType =
  | "OCCLUSION_PREDICTED"
  | "NO_DRIP"
  | "RAPID_FLOW"
  | "AIR_BUBBLE"
  | "IV_COMPLETE"
  | "DEVICE_OFFLINE"
  | "LOW_BATTERY";
export type PatientStatus = "STABLE" | "ATTENTION" | "REDUCED_FLOW" | "CRITICAL" | "AIR_BUBBLE" | "DEVICE_OFFLINE";
export type StaffRole = "NURSE" | "DOCTOR" | "ADMIN" | "BIOMEDICAL";

export interface Staff {
  id: string;
  hospitalId: string;
  email: string;
  name: string;
  role: StaffRole;
}

export interface PatientCardRecord {
  id: string;
  name: string;
  mrn: string;
  room_number: string;
  bed_number: string;
  ward_id: string;
  ward_name: string;
  session_id: string | null;
  fluid_type: string | null;
  volume_ml: number | null;
  rate_ml_hr: string | number | null;
  dpm: string | number;
  flow_rate_ml_hr: string | number;
  bubble_alarm: boolean;
  is_online: boolean | null;
  wifi_rssi: number | null;
  battery_level: number | null;
  ip_address: string | null;
  risk_score: string | number;
  last_telemetry_at: string | null;
}

export interface AlertRecord {
  id: string;
  patient_id: string;
  device_id: string | null;
  session_id: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
  escalation_level: number;
  is_resolved: boolean;
  patient_name?: string;
  room_number?: string;
  bed_number?: string;
}

export interface DeviceRecord {
  id: string;
  device_type: "CAM_MODULE" | "BUBBLE_DETECTOR";
  mac_address: string;
  firmware_version: string;
  ip_address: string | null;
  wifi_rssi: number | null;
  battery_level: number | null;
  last_seen: string | null;
  is_online: boolean;
  bed_number?: string;
  room_number?: string;
  ward_name?: string;
}

export interface TelemetryPoint {
  timestamp: string;
  dpm: string | number | null;
  flow_rate_ml_hr: string | number | null;
  raw_sensor?: string | number | null;
  baseline_sensor?: string | number | null;
  alarm_active: boolean;
}
