create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type ward_type as enum ('ICU','GENERAL','PAEDS','SURGICAL','ONCOLOGY');
  create type bed_status as enum ('OCCUPIED','VACANT','MAINTENANCE');
  create type staff_role as enum ('NURSE','DOCTOR','ADMIN','BIOMEDICAL');
  create type patient_status as enum ('ACTIVE','DISCHARGED','TRANSFERRED');
  create type device_type as enum ('CAM_MODULE','BUBBLE_DETECTOR');
  create type infusion_status as enum ('ACTIVE','COMPLETED','INTERRUPTED','ALARMED');
  create type alert_type as enum ('OCCLUSION_PREDICTED','NO_DRIP','RAPID_FLOW','AIR_BUBBLE','IV_COMPLETE','DEVICE_OFFLINE','LOW_BATTERY');
  create type alert_severity as enum ('INFO','WARNING','CRITICAL');
  create type shift_type as enum ('MORNING','EVENING','NIGHT');
exception when duplicate_object then null; end $$;

create table if not exists hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wards (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null,
  type ward_type not null,
  floor text not null,
  bed_count int not null check (bed_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists beds (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  ward_id uuid not null references wards(id) on delete cascade,
  bed_number text not null,
  room_number text not null,
  status bed_status not null default 'VACANT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ward_id, bed_number)
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  name text not null,
  email citext unique,
  password_hash text not null,
  role staff_role not null,
  ward_assignments uuid[] not null default '{}',
  shift text not null default 'MORNING',
  last_login timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  bed_id uuid not null references beds(id),
  name text not null,
  mrn text not null unique,
  age int not null check (age between 0 and 130),
  gender text not null,
  diagnosis text not null,
  admission_date timestamptz not null default now(),
  attending_doctor_id uuid references staff(id),
  primary_nurse_id uuid references staff(id),
  status patient_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  bed_id uuid references beds(id),
  device_type device_type not null,
  mac_address text not null unique,
  firmware_version text not null,
  ip_address inet,
  wifi_rssi int,
  battery_level int check (battery_level between 0 and 100),
  last_seen timestamptz,
  calibration_data jsonb not null default '{}',
  is_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists infusion_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  device_id uuid not null references devices(id),
  fluid_type text not null,
  volume_ml int not null check (volume_ml > 0),
  rate_ml_hr numeric(8,2) not null check (rate_ml_hr >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status infusion_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists telemetry (
  id bigserial,
  device_id uuid not null references devices(id) on delete cascade,
  session_id uuid not null references infusion_sessions(id) on delete cascade,
  drip_count int,
  flow_rate_ml_hr numeric(8,2),
  dpm numeric(8,2),
  raw_sensor int,
  baseline_sensor numeric(10,2),
  alarm_active boolean not null default false,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (id, timestamp)
) partition by range (timestamp);

create table if not exists telemetry_default partition of telemetry default;

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references infusion_sessions(id) on delete cascade,
  predicted_failure_at timestamptz not null,
  confidence_score numeric(5,4) not null check (confidence_score between 0 and 1),
  trend_slope numeric(10,4) not null,
  consecutive_drops int not null default 0,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  device_id uuid references devices(id),
  session_id uuid references infusion_sessions(id),
  type alert_type not null,
  severity alert_severity not null,
  message text not null,
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references staff(id),
  response_time_seconds int,
  escalation_level int not null default 1,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  ip_address inet,
  timestamp timestamptz not null default now()
);

create table if not exists nurse_assignments (
  id uuid primary key default gen_random_uuid(),
  nurse_id uuid not null references staff(id) on delete cascade,
  bed_id uuid not null references beds(id) on delete cascade,
  shift_date date not null,
  shift_type shift_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nurse_id, bed_id, shift_date, shift_type)
);

create table if not exists shift_handoffs (
  id uuid primary key default gen_random_uuid(),
  from_nurse_id uuid not null references staff(id),
  to_nurse_id uuid not null references staff(id),
  ward_id uuid not null references wards(id),
  handoff_time timestamptz not null default now(),
  notes text not null,
  alert_count_at_handoff int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ declare r record;
begin
  for r in select table_name from information_schema.columns where column_name = 'updated_at' and table_schema = 'public'
  loop
    execute format('drop trigger if exists set_%I_updated_at on %I', r.table_name, r.table_name);
    execute format('create trigger set_%I_updated_at before update on %I for each row execute function set_updated_at()', r.table_name, r.table_name);
  end loop;
end $$;

create index if not exists idx_wards_hospital on wards(hospital_id);
create index if not exists idx_beds_ward_status on beds(ward_id, status);
create index if not exists idx_staff_hospital_role on staff(hospital_id, role);
create index if not exists idx_patients_bed_status on patients(bed_id, status);
create index if not exists idx_devices_bed_online on devices(bed_id, is_online);
create index if not exists idx_sessions_patient_status on infusion_sessions(patient_id, status);
create index if not exists idx_telemetry_session_time on telemetry(session_id, timestamp desc);
create index if not exists idx_telemetry_device_time on telemetry(device_id, timestamp desc);
create index if not exists idx_predictions_session_time on predictions(session_id, generated_at desc);
create index if not exists idx_alerts_active_severity on alerts(is_resolved, severity, triggered_at desc);
create index if not exists idx_audit_staff_time on audit_logs(staff_id, timestamp desc);
