# Bottle Water-Level Monitor

A responsive, single-page dashboard for the ultrasonic bottle water-level project. It has a local simulation mode and an ESP32 mode for USB serial or WebSocket data.

**Live website:** [https://mohammed-shehsin.github.io/Bottle-Water-Monitor/](https://mohammed-shehsin.github.io/Bottle-Water-Monitor/)

## Run locally

1. Install Git and a modern desktop Chrome or Edge browser if you plan to use USB serial.
2. Open a terminal in this folder.
3. Start a local web server:

   **Windows:** `py -m http.server 8000`

   **macOS/Linux:** `python3 -m http.server 8000`

4. Open `http://localhost:8000` in your browser. The Simulation mode works immediately. Do not open `index.html` with `file://`; browser serial access requires a secure context such as localhost or HTTPS.

## ESP32 data formats

### USB UART / COM

In ESP32 mode, choose a port, select the same baud rate as the ESP32 firmware, and connect. The firmware should send one JSON object per line, for example:

```json
{"distance_cm":16.6}
```

or:

```json
{"level_percent":56}
```

The page supports desktop Chromium browsers that implement Web Serial. iPhone browsers do not expose COM ports.

### Wi-Fi WebSocket

Enter a WebSocket endpoint and send one JSON object per WebSocket message using the same fields. On an HTTPS-hosted page, use a secure `wss://` endpoint. A plain `ws://` connection can be used when this page is served locally over HTTP, such as from the ESP32 itself.

## Calibration

The demo uses `D_empty = 30 cm` and `D_full = 6 cm`. Edit `EMPTY_DISTANCE_CM` and `FULL_DISTANCE_CM` near the top of `app.js` to match the installed sensor and bottle. The page maps sensor distance to fill height; tapered bottles need their own calibration if volume percentage is required.


## Project attribution

**SHeHSiN**  
Author: **Shehsin Thamarachalil Abdulresak**

This project is a classroom-oriented ultrasonic bottle water-level monitor with a browser dashboard, ESP32 firmware example, and animated wiring guide.

## Website navigation

- **Simulation:** test the bottle animation and graph without hardware.
- **ESP32 → Dashboard:** view live level, distance, sensor status, and history.
- **ESP32 → Connect:** choose USB Serial/COM or Wi-Fi and connect the device.
- **ESP32 → Schematics:** view the animated HC-SR04-to-ESP32 wiring diagram.
- **ESP32 → Code:** copy the Arduino IDE sketch and upload it to the ESP32.
- **Help (?) button:** explains the navigation, data path, first hardware test, and ECHO voltage safety.

The ESP32 pages are intentionally separated so the dashboard is not crowded with setup information. Select **Dashboard** to return to the bottle view.

## ESP32 Arduino firmware

The Code subsection includes a copyable sketch authored by **Shehsin Thamarachalil Abdulresak**. It:

- Reads the HC-SR04 using TRIG on GPIO 5 and ECHO on GPIO 27.
- Calculates distance using the ultrasonic echo time.
- Converts distance to an estimated level using calibrated empty/full distances.
- Sends one JSON object every 500 ms at 115200 baud.

Example output:

```json
{"distance_cm":16.6,"level_percent":56.0}
```

Before connecting ECHO to GPIO 27, use the resistor divider shown in the Schematics subsection. Use R1 = 2.2 kΩ from HC-SR04 ECHO to the GPIO 27 node, and R2 = 3.3 kΩ from that node to common GND. This reduces the approximately 5 V ECHO signal to a level suitable for the ESP32’s 3.3 V GPIO.
