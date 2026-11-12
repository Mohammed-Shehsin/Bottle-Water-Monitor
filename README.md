# Bottle Water-Level Monitor

A classroom project that estimates bottle fill height with an HC-SR04 ultrasonic sensor and an ESP32. The browser dashboard includes a simulation mode, live ESP32 view, animated wiring schematic, and copyable Arduino firmware.

**Live website:** [Bottle Water-Level Monitor](https://mohammed-shehsin.github.io/Bottle-Water-Monitor/)

**Author:** Shehsin Thamarachalil Abdulresak · **Project label:** SHeHSiN

## Project status

The website and software simulation are complete. The next step is to test the ESP32 and HC-SR04 hardware through USB Serial/COM. The physical sensor connection and readings have not yet been verified.

The included Arduino sketch uses USB Serial at 115200 baud. The website also has a Wi-Fi WebSocket option, which requires WebSocket firmware on the ESP32; that firmware is not included in the current sketch.

## Website navigation

- **Simulation:** demonstrate the filling animation and history graph without hardware.
- **ESP32 → Dashboard:** see live level, distance, status, and measurement history.
- **ESP32 → Connect:** choose USB Serial/COM or Wi-Fi.
- **ESP32 → Schematics:** view the animated HC-SR04 wiring diagram and connection table.
- **ESP32 → Code:** copy the Arduino sketch for the first USB Serial test.
- **Help (?) button:** explains the modes, navigation, data flow, and first hardware test.

The Dashboard is the default ESP32 subsection. Select it to return from Connect, Schematics, or Code.

## Hardware wiring

The diagram and sketch use an ESP32 with GPIO 5 for TRIG and GPIO 27 for ECHO.

| HC-SR04 / divider point | Connect to |
|---|---|
| HC-SR04 VCC | ESP32 5V / VIN |
| HC-SR04 GND | ESP32 GND |
| HC-SR04 TRIG | ESP32 GPIO 5 |
| HC-SR04 ECHO | R1, 2.2 kΩ, then the divider junction |
| Divider junction | ESP32 GPIO 27 |
| R2, 3.3 kΩ | Between the divider junction and GND |

R1 is in series between ECHO and the junction. R2 connects from that junction to common GND. Connect the ESP32, HC-SR04, and divider grounds together.

The HC-SR04 ECHO output can be about 5 V, while ESP32 GPIO uses 3.3 V logic. The divider reduces a nominal 5 V signal to approximately 3.0 V:

`V_GPIO = 5 V × 3.3 kΩ / (2.2 kΩ + 3.3 kΩ) ≈ 3.0 V`

Do not connect the HC-SR04 ECHO pin directly to an ESP32 GPIO.

## First hardware test: USB Serial/COM

1. Open **ESP32 → Code**, copy the sketch, and upload it using Arduino IDE for your ESP32 board.
2. The sketch uses TRIG GPIO 5, ECHO GPIO 27, and 115200 baud. Keep the ESP32 connected by USB.
3. Close Arduino IDE Serial Monitor or any other program currently using the ESP32 COM port.
4. Open the live website in desktop Chrome or Edge. Select **ESP32 → Connect**.
5. Choose **USB Serial / COM**, select the ESP32 port, select **115200 baud**, and connect.
6. Confirm that the connection status changes and that distance, level, bottle fill, and history update.

If readings do not appear, check the selected COM port and baud rate, the TRIG/ECHO pins, the divider, and the common ground. The percentage estimate also depends on correct empty/full calibration.

## Data format

The page accepts one JSON object per line over Serial, or one JSON object per WebSocket message over Wi-Fi:

```json
{"distance_cm":16.6}
```

or

```json
{"level_percent":56}
```

The provided sketch sends both values, for example:

```json
{"distance_cm":16.6,"level_percent":56.0}
```

For Serial, use the same baud rate in the browser and ESP32 firmware. Web Serial requires a supported desktop browser and a secure page context such as HTTPS or localhost. iPhone browsers do not expose COM ports.

For Wi-Fi from this HTTPS-hosted page, use a secure `wss://` WebSocket endpoint. A plain `ws://` endpoint can be used when the page is served locally over HTTP, for example from the ESP32 itself.

## Run locally

From a terminal in the project folder, start a local web server:

**Windows**

```powershell
py -m http.server 8000
```

**macOS / Linux**

```sh
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Do not open the page with a `file://` URL when using browser Serial access.

## Calibration

The example uses an empty distance of 30 cm and a full distance of 6 cm. These are starting values, not universal bottle dimensions. Adjust `EMPTY_DISTANCE_CM` and `FULL_DISTANCE_CM` in `app.js` and the matching constants in the ESP32 sketch to fit the sensor mounting and bottle.

The displayed percentage estimates water height. A tapered bottle does not have a linear relationship between height percentage and volume percentage, so volume estimation requires separate calibration.

## Implementation

- `index.html` — page structure, schematic, navigation, and firmware example
- `styles.css` — responsive layout and visual styling
- `app.js` — simulation, navigation, Serial/WebSocket input, and chart updates

The ESP32 mode shows hardware readings only after valid device data arrives; it does not substitute simulated readings when disconnected.
