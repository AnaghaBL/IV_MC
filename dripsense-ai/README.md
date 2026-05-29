# DripSense AI

Production-oriented hospital web platform for ESP32-CAM IV drip monitoring, ESP32 IR bubble detection, predictive occlusion telemetry, real-time Socket.IO alerts, and ward-level nurse workflows.

## Architecture

```text
ESP32-CAM /stream,/stats       ESP32 IR Bubble Detector       Python MOG2 Predictor
          |                              |                              |
          | direct MJPEG URL             | POST /api/telemetry          | POST /api/telemetry/prediction
          v                              v                              v
    React Patient Monitor  <---- Socket.IO + REST ---->  Node/Express Aggregator
                                                       |
                                                       v
                                             PostgreSQL time-series store
                                                       |
                                                       v
                                              Nginx reverse proxy
```

## Quickstart

```bash
cd dripsense-ai
npm install
npm run typecheck
npm run build
docker compose up --build
```

Seed the database after the `db` and `server` containers are healthy:

```bash
npm run db:seed
```

## No-Docker Local Preview

If Docker/WSL2 is not available, run the mock API and real React UI with Node only.

Terminal 1:

```bash
cd dripsense-ai
npm run start:mock -w apps/server
```

To connect an ESP32-CAM in mock mode, pass its IP before starting the mock server.

PowerShell:

```powershell
$env:ESP32_CAM_IP="192.168.1.42"
npm.cmd run start:mock -w apps/server
```

Terminal 2:

```bash
cd dripsense-ai
npm run dev -w apps/web
```

Open `http://localhost:5173` and log in with `admin@dripsense.local` / `Password123!`.

This mode uses in-memory mock hospital data and live Socket.IO updates. It is for UI and workflow testing; PostgreSQL persistence and Docker services are bypassed.

### OpenCV Hardware Bridge

For real drip analysis, run the Python bridge. It analyzes the ESP32-CAM MJPEG stream with OpenCV and posts live DPM/flow telemetry to the backend.

Terminal 1:

```powershell
cd dripsense-ai
$env:ESP32_CAM_IP="10.173.4.185"
$env:ESP32_STATS_MODE="off"
npm.cmd run start:mock -w apps/server
```

Terminal 2:

```powershell
cd dripsense-ai
npm.cmd run dev -w apps/web
```

Terminal 3:

```powershell
cd ..
python dripsense-ai\tools\opencv_bridge.py --stream http://10.173.4.185/stream --show
```

The website receives the bridge output through `POST /api/telemetry` and updates the monitor, DPM card, and trend graph in real time.

Open:

- Web app: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- Nginx proxy: `http://localhost:8080`
- PgAdmin: `http://localhost:5050`

## Default Credentials

All seeded accounts use `Password123!`.

| Role | Email |
| --- | --- |
| Admin | `admin@dripsense.local` |
| Doctor | `doctor@dripsense.local` |
| Nurse | `nurse1@dripsense.local` |
| Nurse | `nurse2@dripsense.local` |

## Hardware Integration

ESP32-CAM module:

- Connect the firmware to the hospital WiFi.
- Confirm `GET http://<device-ip>/stream` returns MJPEG.
- Register MAC/IP in Devices, or seed a matching device row.
- Patient monitor reads the stored `ip_address` and renders `<img src="http://<ip>/stream">`.

ESP32 bubble/occlusion detector:

- IR sensor: GPIO 34, 12-bit ADC, ADC_11db.
- Buzzer: GPIO 25. LED: GPIO 2.
- Send telemetry every 500 ms:

```json
{
  "deviceId": "50000000-0000-4000-8000-000000000002",
  "raw": 2600,
  "baseline": 3100,
  "alarmActive": false,
  "timestamp": "2026-05-08T09:00:00.000Z"
}
```

- Include `X-Device-Key: city-general-device-key`.

Python predictive monitor:

- Point your OpenCV MOG2 script at the ESP32-CAM `http://<ip>/stream`.
- POST trend predictions to `/api/telemetry/prediction`:

```json
{
  "sessionId": "60000000-0000-4000-8000-000000000001",
  "predictedFailureAt": "2026-05-08T09:14:00.000Z",
  "confidenceScore": 0.82,
  "trendSlope": -2.4,
  "consecutiveDrops": 3,
  "minsRemaining": 14
}
```

## API Reference

Auth:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Clinical:

- `GET /api/patients`
- `GET /api/patients/:id`
- `GET /api/patients/:id/history`
- `GET /api/patients/:id/alerts`
- `GET /api/alerts`
- `PATCH /api/alerts/:id/acknowledge`
- `PATCH /api/alerts/:id/resolve`

Hardware:

- `POST /api/telemetry`
- `POST /api/telemetry/prediction`
- `GET /api/telemetry/:sessionId`
- `GET /api/devices`
- `POST /api/devices`
- `PATCH /api/devices/:id`
- `POST /api/devices/:id/command`
- `GET /api/devices/:id/diagnostics`

Analytics and reports:

- `GET /api/analytics/ward-summary`
- `GET /api/analytics/alert-trends`
- `GET /api/analytics/device-uptime`
- `GET /api/analytics/infusion-stats`
- `POST /api/reports/patient`
- `POST /api/reports/shift`
- `GET /api/reports/export?type=alerts&format=csv`

## Socket.IO Events

Server emits `telemetry:update`, `alert:new`, `alert:escalated`, `alert:acknowledged`, `device:status`, `prediction:update`, and `patient:updated`.

Clients emit `subscribe:ward`, `subscribe:patient`, and `alert:acknowledge`.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SERVER_PORT` | Express and Socket.IO port |
| `CLIENT_ORIGIN` | CORS origin for web app |
| `JWT_ACCESS_SECRET` | 15-minute access token signing secret |
| `JWT_REFRESH_SECRET` | 7-day refresh token signing secret |
| `DEVICE_API_KEY` | Shared hardware telemetry key |
| `VITE_API_URL` | Browser API base URL |
| `VITE_SOCKET_URL` | Browser Socket.IO base URL |

## Notes

- Telemetry is partitioned by range with a default partition. Add daily partitions in production with a scheduled migration job.
- Device commands are queued/audited server-side; firmware command delivery can be added via MQTT or device polling.
- The forgot-password modal is UI-complete; mail/OTP delivery needs an SMTP provider before hospital rollout.
- Production hardening roadmap: PHI audit export review, TLS certificates, hardware certificate enrollment, SSO/SAML, and row-level tenancy controls.
