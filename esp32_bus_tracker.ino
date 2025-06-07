#include <WiFi.h>
#include <PubSubClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT broker settings
const char* mqtt_server = "2b2fa545-09b1-48fc-8672-4b38200019c8-00-39zwajtl8y01.pike.replit.dev";
const int mqtt_port = 1883;
const char* mqtt_username = "bus_device";
const char* mqtt_password = "secure_mqtt_password_123";

// GPS module settings (using SoftwareSerial)
SoftwareSerial gpsSerial(4, 2); // RX, TX pins

// Bus configuration
const char* bus_number = "B001"; // Change this for each bus
const char* mqtt_topic = "buses/B001/telemetry"; // Change B001 to match bus_number

WiFiClient espClient;
PubSubClient client(espClient);

// GPS data structure
struct GPSData {
  float latitude = 0.0;
  float longitude = 0.0;
  float speed = 0.0;
  float heading = 0.0;
  bool fix = false;
};

GPSData gpsData;
unsigned long lastMQTTSend = 0;
const unsigned long SEND_INTERVAL = 5000; // Send data every 5 seconds

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");

  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(onMqttMessage);

  Serial.println("ESP32 Bus Tracker started");
}

void loop() {
  // Maintain MQTT connection
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // Read GPS data
  readGPS();

  // Send telemetry data every 5 seconds
  if (millis() - lastMQTTSend >= SEND_INTERVAL && gpsData.fix) {
    sendTelemetry();
    lastMQTTSend = millis();
  }

  delay(100);
}

void readGPS() {
  while (gpsSerial.available()) {
    String gpsString = gpsSerial.readStringUntil('\n');

    if (gpsString.startsWith("$GPRMC") || gpsString.startsWith("$GNRMC")) {
      parseGPRMC(gpsString);
    }
  }
}

void parseGPRMC(String nmea) {
  // Simple GPRMC parsing
  int commaIndex[12];
  int commaCount = 0;

  // Find all comma positions
  for (int i = 0; i < nmea.length() && commaCount < 12; i++) {
    if (nmea.charAt(i) == ',') {
      commaIndex[commaCount] = i;
      commaCount++;
    }
  }

  if (commaCount < 9) return;

  // Check if fix is valid (field 2)
  String status = nmea.substring(commaIndex[1] + 1, commaIndex[2]);
  if (status != "A") {
    gpsData.fix = false;
    return;
  }

  gpsData.fix = true;

  // Parse latitude (field 3 and 4)
  String latStr = nmea.substring(commaIndex[2] + 1, commaIndex[3]);
  String latDir = nmea.substring(commaIndex[3] + 1, commaIndex[4]);
  if (latStr.length() > 0) {
    float lat = latStr.toFloat();
    int degrees = (int)(lat / 100);
    float minutes = lat - (degrees * 100);
    gpsData.latitude = degrees + (minutes / 60.0);
    if (latDir == "S") gpsData.latitude *= -1;
  }

  // Parse longitude (field 5 and 6)
  String lonStr = nmea.substring(commaIndex[4] + 1, commaIndex[5]);
  String lonDir = nmea.substring(commaIndex[5] + 1, commaIndex[6]);
  if (lonStr.length() > 0) {
    float lon = lonStr.toFloat();
    int degrees = (int)(lon / 100);
    float minutes = lon - (degrees * 100);
    gpsData.longitude = degrees + (minutes / 60.0);
    if (lonDir == "W") gpsData.longitude *= -1;
  }

  // Parse speed (field 7) - convert from knots to km/h
  String speedStr = nmea.substring(commaIndex[6] + 1, commaIndex[7]);
  if (speedStr.length() > 0) {
    gpsData.speed = speedStr.toFloat() * 1.852; // Convert knots to km/h
  }

  // Parse heading (field 8)
  String headingStr = nmea.substring(commaIndex[7] + 1, commaIndex[8]);
  if (headingStr.length() > 0) {
    gpsData.heading = headingStr.toFloat();
  }
}

void sendTelemetry() {
  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["latitude"] = gpsData.latitude;
  doc["longitude"] = gpsData.longitude;
  doc["speed"] = gpsData.speed;
  doc["heading"] = gpsData.heading;
  doc["timestamp"] = WiFi.getTime();

  String payload;
  serializeJson(doc, payload);

  // Publish to MQTT
  if (client.publish(mqtt_topic, payload.c_str())) {
    Serial.println("Telemetry sent: " + payload);
  } else {
    Serial.println("Failed to send telemetry");
  }
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");

    String clientId = "ESP32-" + String(bus_number);

    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Handle incoming MQTT messages if needed
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("]: ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}