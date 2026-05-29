#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "img_converters.h"

// AI Thinker ESP32-CAM pins
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

const char* ssid = "Niyathi 2g";
const char* password = "pranathi";

volatile int dripCount = 0;
volatile float flowRate = 0.0;
volatile float dpm = 0.0;
volatile float currentBrightness = 0.0;
volatile bool currentDropState = false;

unsigned long lastDripTime = 0;
bool dripDetected = false;
float baseline = 0.0;
bool streamActive = false;

const int ROI_HALF_SIZE = 18;
const float DROP_THRESHOLD_RATIO = 0.82; // lower means darker than baseline
const unsigned long MIN_DROP_INTERVAL_MS = 250;

const char* index_html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <title>DripSense Medical Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial; text-align: center; background: #f4f4f4; margin:0; padding:20px; }
    .container { max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 15px; }
    .stat-box { display: flex; justify-content: space-around; gap: 10px; margin-bottom: 20px; }
    .stat { background: #e7f3ff; padding: 15px; border-radius: 10px; flex: 1; }
    img { width: 100%; border-radius: 10px; border: 3px solid #333; }
  </style>
</head>
<body>
  <div class="container">
    <h1>IV Monitoring</h1>
    <div class="stat-box">
      <div class="stat"><h3>Drops</h3><h2 id="drops">0</h2></div>
      <div class="stat"><h3>DPM</h3><h2 id="dpm">0.0</h2></div>
      <div class="stat"><h3>Rate</h3><h2 id="rate">0.0</h2><small>ml/hr</small></div>
    </div>
    <img src="/stream">
  </div>
  <script>
    setInterval(() => {
      fetch('/stats').then(r => r.json()).then(data => {
        document.getElementById('drops').textContent = data.drops;
        document.getElementById('dpm').textContent = data.dpm.toFixed(1);
        document.getElementById('rate').textContent = data.rate.toFixed(1);
      });
    }, 1000);
  </script>
</body>
</html>
)rawliteral";

float centerRoiAverage(camera_fb_t *fb) {
  const int w = fb->width;
  const int h = fb->height;
  const int cx = w / 2;
  const int cy = h / 2;
  long sum = 0;
  int count = 0;

  for (int y = cy - ROI_HALF_SIZE; y <= cy + ROI_HALF_SIZE; y++) {
    if (y < 0 || y >= h) continue;
    for (int x = cx - ROI_HALF_SIZE; x <= cx + ROI_HALF_SIZE; x++) {
      if (x < 0 || x >= w) continue;
      sum += fb->buf[y * w + x]; // valid only because PIXFORMAT_GRAYSCALE
      count++;
    }
  }
  return count > 0 ? (float)sum / count : 255.0;
}

void updateDripDetection(camera_fb_t *fb) {
  float avg = centerRoiAverage(fb);
  currentBrightness = avg;
  if (baseline <= 1.0) baseline = avg;

  // Slowly adapt baseline only when a drop is not currently passing.
  if (!dripDetected) baseline = baseline * 0.98 + avg * 0.02;

  unsigned long now = millis();
  bool darkDrop = avg < (baseline * DROP_THRESHOLD_RATIO);
  currentDropState = darkDrop;

  if (darkDrop && !dripDetected && (now - lastDripTime) > MIN_DROP_INTERVAL_MS) {
    dripCount++;
    if (lastDripTime != 0) {
      unsigned long interval = now - lastDripTime;
      dpm = 60000.0 / interval;
      flowRate = dpm * 0.05 * 60.0; // 20 drops/ml -> 0.05 ml/drop
    }
    lastDripTime = now;
    dripDetected = true;
  }

  if (!darkDrop) dripDetected = false;
}

esp_err_t index_handler(httpd_req_t *req) {
  httpd_resp_send(req, index_html, strlen(index_html));
  return ESP_OK;
}

esp_err_t stats_handler(httpd_req_t *req) {
  char json_response[160];
  snprintf(json_response, sizeof(json_response),
    "{\"drops\":%d,\"dpm\":%.2f,\"rate\":%.2f,\"brightness\":%.2f,\"baseline\":%.2f,\"threshold\":%.2f,\"dark\":%s}",
    dripCount, dpm, flowRate, currentBrightness, baseline, baseline * DROP_THRESHOLD_RATIO, currentDropState ? "true" : "false");
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_send(req, json_response, strlen(json_response));
  return ESP_OK;
}

esp_err_t calibrate_handler(httpd_req_t *req) {
  baseline = currentBrightness > 1.0 ? currentBrightness : baseline;
  dripDetected = false;
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_send(req, "{\"ok\":true}", 11);
  return ESP_OK;
}

esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[96];

  httpd_resp_set_type(req, "multipart/x-mixed-replace;boundary=frame");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  streamActive = true;

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      res = ESP_FAIL;
      streamActive = false;
      break;
    }

    updateDripDetection(fb);

    uint8_t *jpg_buf = NULL;
    size_t jpg_len = 0;
    bool ok = frame2jpg(fb, 12, &jpg_buf, &jpg_len);
    esp_camera_fb_return(fb);

    if (!ok || jpg_buf == NULL) {
      res = ESP_FAIL;
      streamActive = false;
      break;
    }

    size_t hlen = snprintf(part_buf, sizeof(part_buf),
      "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
      (unsigned int)jpg_len);

    httpd_resp_send_chunk(req, "\r\n--frame\r\n", 12);
    httpd_resp_send_chunk(req, part_buf, hlen);
    res = httpd_resp_send_chunk(req, (const char *)jpg_buf, jpg_len);
    free(jpg_buf);

    if (res != ESP_OK) {
      streamActive = false;
      break;
    }
  }
  streamActive = false;
  return res;
}

void background_detection_task(void *parameter) {
  while (true) {
    if (!streamActive) {
      camera_fb_t *fb = esp_camera_fb_get();
      if (fb) {
        updateDripDetection(fb);
        esp_camera_fb_return(fb);
      }
    }
    delay(120);
  }
}

void setup() {
  Serial.begin(115200);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 10000000;
  config.pixel_format = PIXFORMAT_GRAYSCALE;
  config.frame_size = FRAMESIZE_CIF;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed");
    return;
  }

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  httpd_config_t server_config = HTTPD_DEFAULT_CONFIG();
  server_config.server_port = 80;
  server_config.ctrl_port = 32768;
  server_config.max_open_sockets = 7;

  httpd_handle_t server = NULL;
  if (httpd_start(&server, &server_config) == ESP_OK) {
    httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler, .user_ctx = NULL };
    httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL };
    httpd_uri_t stats_uri = { .uri = "/stats", .method = HTTP_GET, .handler = stats_handler, .user_ctx = NULL };
    httpd_uri_t calibrate_uri = { .uri = "/calibrate", .method = HTTP_GET, .handler = calibrate_handler, .user_ctx = NULL };
    httpd_register_uri_handler(server, &index_uri);
    httpd_register_uri_handler(server, &stream_uri);
    httpd_register_uri_handler(server, &stats_uri);
    httpd_register_uri_handler(server, &calibrate_uri);
  }

  xTaskCreatePinnedToCore(
    background_detection_task,
    "drip_detection",
    4096,
    NULL,
    1,
    NULL,
    1
  );
}

void loop() {
  delay(1);
}
