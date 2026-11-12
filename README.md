# Bottle Water-Level Monitor

A responsive, single-page dashboard for the ultrasonic bottle water-level project. It has a local simulation mode and an ESP32 mode for USB serial or WebSocket data.

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

## Publish with GitHub Pages

1. Create a new empty repository on GitHub. Do not add a README or license there if you plan to push this folder as-is.
2. Open a terminal in this folder and run:

   ```bash
   git init -b main
   git add index.html styles.css app.js README.md
   git commit -m "Add bottle water-level dashboard"
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

   Replace the remote URL with the URL shown by your GitHub repository.

3. In GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Open the published URL shown in the Pages settings after deployment completes. GitHub Pages serves over HTTPS, so the dashboard's Wi-Fi mode will require `wss://`. USB serial works only in a supported desktop browser.

## Calibration

The demo uses `D_empty = 30 cm` and `D_full = 6 cm`. Edit `EMPTY_DISTANCE_CM` and `FULL_DISTANCE_CM` near the top of `app.js` to match the installed sensor and bottle. The page maps sensor distance to fill height; tapered bottles need their own calibration if volume percentage is required.
