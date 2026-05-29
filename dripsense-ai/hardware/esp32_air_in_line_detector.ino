// IV Air-in-Line Detector - Final Version

const int sensorPin = 34;   // IR sensor output (analog)
const int buzzerPin = 25;   // Buzzer or alarm
const int ledPin = 2;       // Built-in LED

// Detection variables
float smoothedValue = 800;      // Initial baseline (adjust if needed)
float thresholdFactor = 0.85;   // Trigger when signal drops below 85%
bool alarmActive = false;

void setup() {
  Serial.begin(115200);

  pinMode(buzzerPin, OUTPUT);
  pinMode(ledPin, OUTPUT);

  // ESP32 ADC settings
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  Serial.println("System Initializing...");
  delay(1000);
}

void loop() {
  // -------- 1. Oversampling (reduce noise) --------
  long sum = 0;
  for (int i = 0; i < 100; i++) {
    sum += analogRead(sensorPin);
  }
  int currentRaw = sum / 100;

  // -------- 2. EMA Filter (smooth baseline) --------
  smoothedValue = (currentRaw * 0.02) + (smoothedValue * 0.98);

  // -------- 3. Bubble Detection Logic --------
  float currentThreshold = smoothedValue * thresholdFactor;

  if (currentRaw < currentThreshold) {
    alarmActive = true;
  } else {
    alarmActive = false;
  }

  // -------- 4. Serial Output (for plotter/demo) --------
  Serial.print("Min:0,Max:1200,");
  Serial.print("Baseline:");
  Serial.print(smoothedValue);
  Serial.print(",Current:");
  Serial.print(currentRaw);
  Serial.print(",Alarm:");
  Serial.println(alarmActive ? 1100 : 0);

  // -------- 5. Alert Output --------
  if (alarmActive) {
    digitalWrite(buzzerPin, HIGH);
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(buzzerPin, LOW);
    digitalWrite(ledPin, LOW);
  }

  delay(10); // fast monitoring
}
