import cv2
import requests
import numpy as np
import time

url = "http://10.173.4.185/stream"
BACKEND_URL = "http://localhost:4000"
DEVICE_ID = "50000000-0000-4000-8000-000000000001"
SESSION_ID = "60000000-0000-4000-8000-000000000001"

# --- CONFIGURATION ---
WINDOW_TIME = 10       
THRESHOLD_PCT = -2.0   
TREND_LIMIT = 3        

# Global Tracking
window_averages = []
current_window_drips = 0
window_start_time = time.time()                         
negative_trend_count = 0
total_drips = 0
last_backend_post = 0
last_prediction_post = 0

def post_telemetry(dpm, flow_rate):
    payload = {
        "deviceId": DEVICE_ID,
        "dripCount": total_drips,
        "dpm": round(float(dpm), 2),
        "flowRateMlHr": round(float(flow_rate), 2),
        "alarmActive": False,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    try:
        requests.post(f"{BACKEND_URL}/api/telemetry", json=payload, timeout=0.6)
    except requests.RequestException:
        pass

def post_prediction(mins_to_zero, loss_per_min):
    payload = {
        "sessionId": SESSION_ID,
        "predictedFailureAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + max(0, mins_to_zero) * 60)),
        "confidenceScore": 0.82,
        "trendSlope": -abs(float(loss_per_min)),
        "consecutiveDrops": negative_trend_count,
        "minsRemaining": round(max(0, float(mins_to_zero)), 1)
    }
    try:
        requests.post(f"{BACKEND_URL}/api/telemetry/prediction", json=payload, timeout=0.6)
    except requests.RequestException:
        pass

def draw_graph(canvas, data, max_val=100):
    if len(data) < 2: return canvas
    h, w, _ = canvas.shape
    pts = []
    for i, val in enumerate(data[-20:]): 
        x = w - 240 + (i * 10) 
        y = h - int((val / max_val) * 80) - 20
        pts.append([x, y])
    pts = np.array(pts, np.int32)
    cv2.polylines(canvas, [pts], False, (0, 255, 255), 2)
    return canvas

print("Launching Protocol: Predictive Occlusion Monitor...")

try:
    stream = requests.get(url, stream=True, timeout=5)
    if stream.status_code == 200:
        bytes_data = bytes()
        last_drip_time = time.time()
        drip_detected = False
        backSub = cv2.createBackgroundSubtractorMOG2(history=50, varThreshold=40)

        for chunk in stream.iter_content(chunk_size=512):
            bytes_data += chunk
            a = bytes_data.find(b'\xff\xd8')
            b = bytes_data.find(b'\xff\xd9')
            
            if a != -1 and b != -1:
                jpg = bytes_data[a:b+2]
                bytes_data = bytes_data[b+2:]
                if len(jpg) < 500: continue
                img = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
                if img is None: continue

                img = cv2.resize(img, (640, 480))
                h, w, _ = img.shape

                # --- 1. MOTION DETECTION ---
                fgMask = backSub.apply(img)
                roi = fgMask[int(h/3):int(2*h/3), int(w/3):int(2*w/3)]
                
                now = time.time()
                if (np.sum(roi) / 255) > 40:
                    if not drip_detected and (now - last_drip_time) > 0.4:
                        total_drips += 1
                        current_window_drips += 1
                        last_drip_time = now
                        drip_detected = True
                else:
                    drip_detected = False

                # --- 2. RECTIFIED WINDOW LOGIC ---
                if (now - window_start_time) >= WINDOW_TIME:
                    avg_dpm = current_window_drips * (60 / WINDOW_TIME)
                    window_averages.append(avg_dpm)
                    
                    if len(window_averages) >= 2:
                        prev = window_averages[-2]
                        curr = window_averages[-1]
                        
                        # Fix: If curr is 0 and prev > 0, that's a -100% change
                        change = ((curr - prev) / prev * 100) if prev > 0 else 0
                        
                        # JUSTIFICATION: Any decrease >= 2% increments the trend
                        if change <= THRESHOLD_PCT: 
                            negative_trend_count += 1
                        else: 
                            negative_trend_count = 0 # Flow recovered or stayed stable
                    
                    window_start_time = now
                    current_window_drips = 0

                # --- 3. UI ENHANCEMENTS ---
                cv2.rectangle(img, (0,0), (w, 90), (30, 30, 30), -1)
                status_color = (0, 255, 0)
                status_text = "STABLE FLOW"
                prediction_text = ""

                if negative_trend_count >= TREND_LIMIT:
                    status_text = "OCCLUSION IMMINENT"
                    status_color = (0, 0, 255)
                    # Use the first and last window of the trend to find the slope
                    loss = window_averages[-TREND_LIMIT] - window_averages[-1]
                    # Avoid division by zero if flow stopped instantly
                    loss_per_min = max(0.1, loss / (WINDOW_TIME * TREND_LIMIT / 60))
                    mins_to_zero = window_averages[-1] / loss_per_min
                    prediction_text = f"PREDICTED FAILURE IN: {max(0, mins_to_zero):.1f} MINS"
                    if (now - last_prediction_post) > 10:
                        post_prediction(mins_to_zero, loss_per_min)
                        last_prediction_post = now

                elapsed_window = max(1, now - window_start_time)
                live_dpm = current_window_drips * (60 / elapsed_window)
                display_dpm = window_averages[-1] if window_averages else live_dpm
                flow_rate_ml_hr = display_dpm * 3.0

                if (now - last_backend_post) >= 1:
                    post_telemetry(display_dpm, flow_rate_ml_hr)
                    last_backend_post = now

                cv2.putText(img, f"FLOW: {display_dpm:.1f} DPM", (20, 35), 2, 0.8, (255, 255, 255), 2)
                cv2.putText(img, status_text, (20, 70), 2, 0.9, status_color, 2)
                cv2.putText(img, f"TREND: {negative_trend_count}/3", (w-180, 35), 2, 0.6, (0, 255, 255), 1)

                cv2.rectangle(img, (w-250, h-130), (w-10, h-10), (50, 50, 50), -1)
                cv2.putText(img, "DPM TREND", (w-240, h-110), 2, 0.4, (200, 200, 200), 1)
                img = draw_graph(img, window_averages)

                if prediction_text:
                    alpha = (np.sin(time.time() * 5) + 1) / 2
                    overlay = img.copy()
                    cv2.rectangle(overlay, (0, h-50), (w, h), (0, 0, 255), -1)
                    cv2.addWeighted(overlay, alpha * 0.4, img, 1 - alpha * 0.4, 0, img)
                    cv2.putText(img, prediction_text, (w//2 - 200, h-15), 2, 0.7, (255, 255, 255), 2)

                cv2.imshow('AI PREDICTIVE MEDICAL MONITOR', img)
                if cv2.waitKey(1) == 27: break

except Exception as e:
    print(f"Error: {e}")
finally:
    cv2.destroyAllWindows()
