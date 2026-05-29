import argparse
import time

import cv2
import numpy as np
import requests


def post_json(url, payload, timeout=1.5):
    try:
        requests.post(url, json=payload, timeout=timeout)
    except requests.RequestException:
        pass


def draw_graph(canvas, data, max_val=100):
    if len(data) < 2:
        return canvas
    h, w, _ = canvas.shape
    pts = []
    for i, val in enumerate(data[-20:]):
        x = w - 240 + (i * 10)
        y = h - int((val / max_val) * 80) - 20
        pts.append([x, y])
    cv2.polylines(canvas, [np.array(pts, np.int32)], False, (0, 255, 255), 2)
    return canvas


def open_stream(url, timeout, retry_seconds):
    while True:
        try:
            print(f"connecting to MJPEG stream: {url}", flush=True)
            stream = requests.get(url, stream=True, timeout=timeout)
            stream.raise_for_status()
            print("MJPEG stream connected", flush=True)
            return stream
        except requests.RequestException as exc:
            print(
                f"stream unavailable: {exc}. Retrying in {retry_seconds:.1f}s. "
                "Check the ESP32 serial IP, Wi-Fi network, and that /stream opens in a browser.",
                flush=True
            )
            time.sleep(retry_seconds)


def main():
    parser = argparse.ArgumentParser(description="DripSense OpenCV stream analyzer bridge")
    parser.add_argument("--stream", required=True, help="ESP32-CAM MJPEG stream URL, e.g. http://10.168.148.185/stream")
    parser.add_argument("--backend", default="http://localhost:4000", help="DripSense backend URL")
    parser.add_argument("--device-id", default="50000000-0000-4000-8000-000000000001")
    parser.add_argument("--window-time", type=float, default=10.0)
    parser.add_argument("--threshold-pct", type=float, default=-2.0)
    parser.add_argument("--trend-limit", type=int, default=3)
    parser.add_argument("--connect-timeout", type=float, default=5.0)
    parser.add_argument("--retry-seconds", type=float, default=5.0)
    parser.add_argument("--show", action="store_true", help="Show OpenCV debug dashboard")
    args = parser.parse_args()

    telemetry_url = f"{args.backend.rstrip('/')}/api/telemetry"
    prediction_url = f"{args.backend.rstrip('/')}/api/telemetry/prediction"

    window_averages = []
    current_window_drips = 0
    window_start_time = time.time()
    negative_trend_count = 0
    total_drips = 0
    last_drip_time = time.time()
    drip_detected = False
    last_post_time = 0.0

    bytes_data = bytes()
    back_sub = cv2.createBackgroundSubtractorMOG2(history=50, varThreshold=40)
    should_stop = False

    while not should_stop:
        stream = open_stream(args.stream, args.connect_timeout, args.retry_seconds)
        try:
            chunks = stream.iter_content(chunk_size=512)
            for chunk in chunks:
                bytes_data += chunk
                a = bytes_data.find(b"\xff\xd8")
                b = bytes_data.find(b"\xff\xd9")
                if a == -1 or b == -1:
                    continue

                jpg = bytes_data[a:b + 2]
                bytes_data = bytes_data[b + 2:]
                if len(jpg) < 500:
                    continue

                img = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                if img is None:
                    continue

                img = cv2.resize(img, (640, 480))
                h, w, _ = img.shape
                fg_mask = back_sub.apply(img)
                roi = fg_mask[int(h / 3):int(2 * h / 3), int(w / 3):int(2 * w / 3)]

                now = time.time()
                if (np.sum(roi) / 255) > 40:
                    if not drip_detected and (now - last_drip_time) > 0.4:
                        total_drips += 1
                        current_window_drips += 1
                        last_drip_time = now
                        drip_detected = True
                else:
                    drip_detected = False

                current_dpm = current_window_drips * (60 / max(1.0, now - window_start_time))
                flow_rate = current_dpm * 3.0

                if now - last_post_time >= 1.0:
                    post_json(telemetry_url, {
                        "deviceId": args.device_id,
                        "dripCount": total_drips,
                        "dpm": round(current_dpm, 2),
                        "flowRateMlHr": round(flow_rate, 2),
                        "alarmActive": False,
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    })
                    last_post_time = now

                if (now - window_start_time) >= args.window_time:
                    avg_dpm = current_window_drips * (60 / args.window_time)
                    window_averages.append(avg_dpm)

                    if len(window_averages) >= 2:
                        prev = window_averages[-2]
                        curr = window_averages[-1]
                        change = ((curr - prev) / prev * 100) if prev > 0 else 0
                        negative_trend_count = negative_trend_count + 1 if change <= args.threshold_pct else 0

                    if negative_trend_count >= args.trend_limit:
                        loss = window_averages[-args.trend_limit] - window_averages[-1]
                        loss_per_min = max(0.1, loss / (args.window_time * args.trend_limit / 60))
                        mins_to_zero = max(0, window_averages[-1] / loss_per_min)
                        post_json(prediction_url, {
                            "sessionId": "60000000-0000-4000-8000-000000000001",
                            "predictedFailureAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + mins_to_zero * 60)),
                            "confidenceScore": 0.82,
                            "trendSlope": -abs(loss_per_min),
                            "consecutiveDrops": negative_trend_count,
                            "minsRemaining": round(mins_to_zero, 1)
                        })

                    window_start_time = now
                    current_window_drips = 0

                if args.show:
                    status_color = (0, 255, 0)
                    status_text = "STABLE FLOW"
                    if negative_trend_count >= args.trend_limit:
                        status_text = "OCCLUSION IMMINENT"
                        status_color = (0, 0, 255)
                    cv2.rectangle(img, (0, 0), (w, 90), (30, 30, 30), -1)
                    cv2.putText(img, f"FLOW: {current_dpm:.1f} DPM", (20, 35), 2, 0.8, (255, 255, 255), 2)
                    cv2.putText(img, status_text, (20, 70), 2, 0.9, status_color, 2)
                    cv2.putText(img, f"TREND: {negative_trend_count}/3", (w - 180, 35), 2, 0.6, (0, 255, 255), 1)
                    cv2.rectangle(img, (w - 250, h - 130), (w - 10, h - 10), (50, 50, 50), -1)
                    cv2.putText(img, "DPM TREND", (w - 240, h - 110), 2, 0.4, (200, 200, 200), 1)
                    img = draw_graph(img, window_averages)
                    cv2.imshow("DripSense OpenCV Bridge", img)
                    if cv2.waitKey(1) == 27:
                        should_stop = True
                        break
        except requests.RequestException as exc:
            print(f"stream disconnected: {exc}. Reconnecting in {args.retry_seconds:.1f}s.", flush=True)
            bytes_data = bytes()
            time.sleep(args.retry_seconds)
        finally:
            stream.close()

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
