truncate shift_handoffs, nurse_assignments, audit_logs, alerts, predictions, telemetry, infusion_sessions, devices, patients, staff, beds, wards, hospitals restart identity cascade;

with hospital as (
  insert into hospitals (id, name, address, logo_url)
  values ('00000000-0000-4000-8000-000000000001', 'City General Hospital', '42 Care Avenue, Metro District', '/logo.svg')
  returning id
),
wards_seed as (
  insert into wards (id, hospital_id, name, type, floor, bed_count)
  values
  ('10000000-0000-4000-8000-000000000001', (select id from hospital), 'ICU', 'ICU', '4', 8),
  ('10000000-0000-4000-8000-000000000002', (select id from hospital), 'Surgical', 'SURGICAL', '3', 16),
  ('10000000-0000-4000-8000-000000000003', (select id from hospital), 'General', 'GENERAL', '2', 24)
  returning id
),
beds_seed as (
  insert into beds (id, hospital_id, ward_id, bed_number, room_number, status)
  select format('20000000-0000-4000-8000-%s', lpad(gs::text, 12, '0'))::uuid, (select id from hospital),
    case when gs <= 8 then '10000000-0000-4000-8000-000000000001'::uuid when gs <= 24 then '10000000-0000-4000-8000-000000000002'::uuid else '10000000-0000-4000-8000-000000000003'::uuid end,
    concat('B', gs), concat(case when gs <= 8 then 'ICU-' when gs <= 24 then 'S-' else 'G-' end, lpad(gs::text, 2, '0')),
    case when gs <= 12 then 'OCCUPIED'::bed_status else 'VACANT'::bed_status end
  from generate_series(1, 48) gs
  returning id
),
staff_seed as (
  insert into staff (id, hospital_id, name, email, password_hash, role, ward_assignments, shift)
  values
  ('30000000-0000-4000-8000-000000000001', (select id from hospital), 'Avery Shah', 'admin@dripsense.local', crypt('Password123!', gen_salt('bf')), 'ADMIN', array['10000000-0000-4000-8000-000000000001'::uuid,'10000000-0000-4000-8000-000000000002'::uuid], 'MORNING'),
  ('30000000-0000-4000-8000-000000000002', (select id from hospital), 'Dr. Meera Rao', 'doctor@dripsense.local', crypt('Password123!', gen_salt('bf')), 'DOCTOR', array['10000000-0000-4000-8000-000000000001'::uuid], 'MORNING'),
  ('30000000-0000-4000-8000-000000000003', (select id from hospital), 'Nurse Liam Carter', 'nurse1@dripsense.local', crypt('Password123!', gen_salt('bf')), 'NURSE', array['10000000-0000-4000-8000-000000000001'::uuid,'10000000-0000-4000-8000-000000000002'::uuid], 'EVENING'),
  ('30000000-0000-4000-8000-000000000004', (select id from hospital), 'Nurse Priya Menon', 'nurse2@dripsense.local', crypt('Password123!', gen_salt('bf')), 'NURSE', array['10000000-0000-4000-8000-000000000003'::uuid], 'NIGHT')
  returning id
),
patients_seed as (
  insert into patients (id, hospital_id, bed_id, name, mrn, age, gender, diagnosis, attending_doctor_id, primary_nurse_id, admission_date)
  values
  ('40000000-0000-4000-8000-000000000001', (select id from hospital), '20000000-0000-4000-8000-000000000001', 'Elena Brooks', 'MRN-240001', 68, 'Female', 'Sepsis observation', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '3 days'),
  ('40000000-0000-4000-8000-000000000002', (select id from hospital), '20000000-0000-4000-8000-000000000002', 'Marcus Chen', 'MRN-240002', 54, 'Male', 'Post-op monitoring', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000003', (select id from hospital), '20000000-0000-4000-8000-000000000003', 'Samira Khan', 'MRN-240003', 37, 'Female', 'Pneumonia', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '5 days'),
  ('40000000-0000-4000-8000-000000000004', (select id from hospital), '20000000-0000-4000-8000-000000000004', 'Noah Williams', 'MRN-240004', 75, 'Male', 'CHF exacerbation', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000005', (select id from hospital), '20000000-0000-4000-8000-000000000005', 'Grace Patel', 'MRN-240005', 29, 'Female', 'Hyperemesis', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '10 hours'),
  ('40000000-0000-4000-8000-000000000006', (select id from hospital), '20000000-0000-4000-8000-000000000006', 'Owen Miller', 'MRN-240006', 61, 'Male', 'Cellulitis', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '4 days'),
  ('40000000-0000-4000-8000-000000000007', (select id from hospital), '20000000-0000-4000-8000-000000000007', 'Mina Alvarez', 'MRN-240007', 46, 'Female', 'Surgical recovery', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '7 hours'),
  ('40000000-0000-4000-8000-000000000008', (select id from hospital), '20000000-0000-4000-8000-000000000008', 'Theo Brown', 'MRN-240008', 82, 'Male', 'Dehydration', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now() - interval '6 days'),
  ('40000000-0000-4000-8000-000000000009', (select id from hospital), '20000000-0000-4000-8000-000000000009', 'Iris Novak', 'MRN-240009', 43, 'Female', 'Vancomycin infusion', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', now() - interval '9 hours'),
  ('40000000-0000-4000-8000-000000000010', (select id from hospital), '20000000-0000-4000-8000-000000000010', 'Dev Singh', 'MRN-240010', 57, 'Male', 'Anticoagulation', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', now() - interval '12 hours'),
  ('40000000-0000-4000-8000-000000000011', (select id from hospital), '20000000-0000-4000-8000-000000000011', 'Hana Ito', 'MRN-240011', 33, 'Female', 'Electrolyte replacement', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', now() - interval '16 hours'),
  ('40000000-0000-4000-8000-000000000012', (select id from hospital), '20000000-0000-4000-8000-000000000012', 'Robert Ellis', 'MRN-240012', 70, 'Male', 'Oncology hydration', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000004', now() - interval '2 days')
  returning id
),
devices_seed as (
  insert into devices (id, hospital_id, bed_id, device_type, mac_address, firmware_version, ip_address, wifi_rssi, battery_level, last_seen, calibration_data, is_online)
  values
  ('50000000-0000-4000-8000-000000000001', (select id from hospital), '20000000-0000-4000-8000-000000000001', 'CAM_MODULE', 'ESP32-CAM-00-01', '1.4.2', '10.19.187.185', -52, 88, now() - interval '4 seconds', '{"frame":"CIF","jpegQuality":12}', true),
  ('50000000-0000-4000-8000-000000000002', (select id from hospital), '20000000-0000-4000-8000-000000000001', 'BUBBLE_DETECTOR', 'ESP32-BUB-00-01', '1.2.0', '10.19.187.186', -55, 91, now() - interval '2 seconds', '{"emaAlpha":0.02,"threshold":0.85}', true),
  ('50000000-0000-4000-8000-000000000003', (select id from hospital), '20000000-0000-4000-8000-000000000002', 'CAM_MODULE', 'ESP32-CAM-00-02', '1.4.2', '10.19.187.187', -61, 72, now() - interval '15 seconds', '{"frame":"CIF","jpegQuality":12}', true),
  ('50000000-0000-4000-8000-000000000004', (select id from hospital), '20000000-0000-4000-8000-000000000002', 'BUBBLE_DETECTOR', 'ESP32-BUB-00-02', '1.2.0', '10.19.187.188', -63, 76, now() - interval '8 seconds', '{"emaAlpha":0.02,"threshold":0.85}', true),
  ('50000000-0000-4000-8000-000000000005', (select id from hospital), '20000000-0000-4000-8000-000000000003', 'CAM_MODULE', 'ESP32-CAM-00-03', '1.4.1', '10.19.187.189', -73, 45, now() - interval '80 seconds', '{"frame":"CIF","jpegQuality":12}', false),
  ('50000000-0000-4000-8000-000000000006', (select id from hospital), '20000000-0000-4000-8000-000000000004', 'BUBBLE_DETECTOR', 'ESP32-BUB-00-04', '1.2.0', '10.19.187.190', -58, 83, now() - interval '5 seconds', '{"emaAlpha":0.02,"threshold":0.85}', true),
  ('50000000-0000-4000-8000-000000000007', (select id from hospital), '20000000-0000-4000-8000-000000000005', 'CAM_MODULE', 'ESP32-CAM-00-05', '1.4.2', '10.19.187.191', -50, 67, now() - interval '20 seconds', '{"frame":"CIF","jpegQuality":12}', true),
  ('50000000-0000-4000-8000-000000000008', (select id from hospital), '20000000-0000-4000-8000-000000000006', 'BUBBLE_DETECTOR', 'ESP32-BUB-00-06', '1.2.0', '10.19.187.192', -69, 38, now() - interval '35 seconds', '{"emaAlpha":0.02,"threshold":0.85}', true)
  returning id
),
sessions_seed as (
  insert into infusion_sessions (id, patient_id, device_id, fluid_type, volume_ml, rate_ml_hr, started_at, status)
  values
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Normal Saline 0.9%', 1000, 95, now() - interval '2 hours', 'ACTIVE'),
  ('60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', 'Ringer''s Lactate', 500, 80, now() - interval '90 minutes', 'ACTIVE'),
  ('60000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000005', 'D5W', 1000, 110, now() - interval '50 minutes', 'ACTIVE'),
  ('60000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000006', 'Vancomycin 500mg', 250, 60, now() - interval '35 minutes', 'ACTIVE'),
  ('60000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000007', 'Heparin 5000U', 100, 45, now() - interval '25 minutes', 'ACTIVE')
  returning id
)
insert into telemetry (device_id, session_id, drip_count, flow_rate_ml_hr, dpm, raw_sensor, baseline_sensor, alarm_active, timestamp)
select s.device_id, s.id, floor(40 + random()*40)::int, 40 + random()*80, 40 + random()*40,
  floor(2400 + random()*900)::int, 3100 + random()*120, false, now() - make_interval(days => d, mins => m)
from sessions_seed s
cross join generate_series(0, 30) d
cross join generate_series(0, 23) m;

insert into alerts (patient_id, device_id, session_id, type, severity, message, triggered_at, escalation_level)
values
('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','AIR_BUBBLE','CRITICAL','Air bubble detected by IR sensor', now() - interval '3 minutes', 1),
('40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000002','OCCLUSION_PREDICTED','WARNING','Occlusion predicted in 14 minutes', now() - interval '8 minutes', 2),
('40000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000003','DEVICE_OFFLINE','INFO','Camera module has not reported for 80 seconds', now() - interval '10 minutes', 1);

insert into predictions (session_id, predicted_failure_at, confidence_score, trend_slope, consecutive_drops)
values ('60000000-0000-4000-8000-000000000002', now() + interval '14 minutes', 0.82, -2.4, 3);
