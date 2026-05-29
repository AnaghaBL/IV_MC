import argparse
import re
import time

import requests

try:
    import serial
except ImportError as exc:
    raise SystemExit("pyserial is required. Install it with: pip install pyserial") from exc


LINE_RE = re.compile(
    r"Baseline:(?P<baseline>-?\d+(?:\.\d+)?),Current:(?P<current>-?\d+(?:\.\d+)?),Alarm:(?P<alarm>-?\d+(?:\.\d+)?)"
)


def parse_line(line):
    match = LINE_RE.search(line)
    if not match:
        return None
    baseline = float(match.group("baseline"))
    current = float(match.group("current"))
    alarm_value = float(match.group("alarm"))
    return {
        "baseline": baseline,
        "raw": round(current),
        "alarmActive": alarm_value > 0,
    }


def post_telemetry(url, device_key, payload):
    headers = {}
    if device_key:
        headers["X-Device-Key"] = device_key
    response = requests.post(url, json=payload, headers=headers, timeout=1.5)
    response.raise_for_status()


def main():
    parser = argparse.ArgumentParser(description="Bridge ESP32 air-in-line Serial output into DripSense telemetry")
    parser.add_argument("--port", required=True, help="Serial port, e.g. COM5")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--backend", default="http://localhost:4000", help="DripSense backend URL")
    parser.add_argument("--device-id", default="50000000-0000-4000-8000-000000000001")
    parser.add_argument("--device-key", default="", help="Required for the production API. Mock API does not require it.")
    parser.add_argument("--post-interval", type=float, default=0.5, help="Seconds between telemetry posts")
    args = parser.parse_args()

    telemetry_url = f"{args.backend.rstrip('/')}/api/telemetry"
    last_post = 0.0

    print(f"opening {args.port} at {args.baud} baud", flush=True)
    with serial.Serial(args.port, args.baud, timeout=1) as ser:
        time.sleep(2)
        print(f"posting air-in-line telemetry to {telemetry_url}", flush=True)
        for raw_line in ser:
            line = raw_line.decode("utf-8", errors="ignore").strip()
            values = parse_line(line)
            if not values:
                continue

            now = time.time()
            if now - last_post < args.post_interval:
                continue

            payload = {
                "deviceId": args.device_id,
                "raw": values["raw"],
                "baseline": round(values["baseline"], 2),
                "alarmActive": values["alarmActive"],
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
            }

            try:
                post_telemetry(telemetry_url, args.device_key, payload)
                state = "ALARM" if values["alarmActive"] else "clear"
                print(f"{state}: current={values['raw']} baseline={values['baseline']:.2f}", flush=True)
                last_post = now
            except requests.RequestException as exc:
                print(f"telemetry post failed: {exc}", flush=True)
                time.sleep(1)


if __name__ == "__main__":
    main()
