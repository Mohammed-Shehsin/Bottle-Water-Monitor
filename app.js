(() => {
  const EMPTY_DISTANCE_CM = 30;
  const FULL_DISTANCE_CM = 6;
  const DATA_TIMEOUT_MS = 6000;
  const $ = (id) => document.getElementById(id);
  const slider = $("fillRange");
  const rangeOutput = $("rangeOutput");
  const water = $("waterRect");
  const surface = $("surface");
  const gauge = $("gaugeProgress");
  const toggleButton = $("toggleBtn");
  const simulationControls = $("simulationControls");
  const connectionPanel = $("connectionPanel");
  const wiringGuide = $("wiringGuide");
  const serialSelect = $("serialPortSelect");
  const baudSelect = $("baudSelect");
  const serialConnectButton = $("serialConnectBtn");
  const choosePortButton = $("choosePortBtn");
  const wifiConnectButton = $("wifiConnectBtn");
  const wifiUrl = $("wifiUrl");
  const statusText = $("connectionStatusText");
  const connectionStatus = $("connectionStatus");
  const sensorTag = $("sensorTag");
  const history = [];
  const circumference = 2 * Math.PI * 24;

  let mode = "simulation";
  let simulationLevel = 56;
  let fillTimer = null;
  let selectedPort = null;
  let knownPorts = [];
  let serialReader = null;
  let serialPort = null;
  let serialConnected = false;
  let socket = null;
  let lastHardwareReading = 0;
  let lastChartPoint = 0;

  $("gaugeProgress").style.strokeDasharray = String(circumference);
  [0, 25, 50, 75, 100].forEach((value) => {
    const y = 101 - (value / 100) * 84;
    $("chartGrid").insertAdjacentHTML(
      "beforeend",
      '<line class="grid-line" x1="40" y1="' + y + '" x2="610" y2="' + y + '"></line>' +
      '<text class="chart-label" x="2" y="' + (y + 3) + '">' + value + '%</text>'
    );
  });

  function setConnectionState(state, message) {
    connectionStatus.dataset.state = state;
    statusText.textContent = message;
  }

  function setClock() {
    $("timeValue").textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }

  function drawChart() {
    const values = history.slice(-24);
    const line = $("chartLine");
    const area = $("chartArea");
    const points = $("chartPoints");
    if (!values.length) {
      line.setAttribute("d", "");
      area.setAttribute("d", "");
      points.innerHTML = "";
      return;
    }
    const left = 45, right = 610, top = 15, bottom = 103;
    const coords = values.map((value, index) => ({
      x: left + (values.length < 2 ? 0 : index * (right - left) / (values.length - 1)),
      y: bottom - (value / 100) * (bottom - top)
    }));
    const d = coords.map((point, index) =>
      (index ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1)
    ).join(" ");
    line.setAttribute("d", d);
    area.setAttribute("d", d + " L " + coords[coords.length - 1].x + " " + bottom +
      " L " + coords[0].x + " " + bottom + " Z");
    points.innerHTML = coords
      .filter((_, index) => index === coords.length - 1 || index % 5 === 0)
      .map(point => '<circle class="chart-point" cx="' + point.x + '" cy="' + point.y + '" r="4"></circle>')
      .join("");
  }

  function addHistoryPoint(level, force = false) {
    const now = Date.now();
    if (force || now - lastChartPoint >= 1800) {
      history.push(Math.round(level));
      if (history.length > 30) history.shift();
      lastChartPoint = now;
      drawChart();
    }
  }

  function paintBottle(level) {
    const fill = Math.max(0, Math.min(100, Number(level)));
    const y = 310 - (215 * fill / 100);
    water.setAttribute("y", String(y));
    water.setAttribute("height", String(338 - y));
    surface.setAttribute("transform", "translate(0 " + (y - 208) + ")");
    document.querySelector(".bottle-svg").setAttribute(
      "aria-label", "Illustration of a bottle filled to " + Math.round(fill) + " percent"
    );
    gauge.style.strokeDashoffset = String(circumference * (1 - fill / 100));
  }

  function renderValues(fill, distance, source, record = true) {
    const boundedFill = Math.max(0, Math.min(100, Number(fill)));
    const boundedDistance = Math.max(0, Number(distance));
    paintBottle(boundedFill);
    $("levelValue").textContent = String(Math.round(boundedFill));
    $("distanceValue").textContent = boundedDistance.toFixed(1);
    $("bottleDistance").textContent = boundedDistance.toFixed(1) + " cm";
    $("statusValue").textContent = "Reading normally";
    $("statusNote").textContent = source === "esp32"
      ? "Live ESP32 data · received in this browser"
      : "Simulation data · hardware not connected";
    $("updated").textContent = source === "esp32"
      ? "ESP32 readings · updated just now"
      : "Demo readings · updated just now";
    setClock();
    if (record) addHistoryPoint(boundedFill);
  }

  function renderSimulation(next, record = true) {
    simulationLevel = Math.max(0, Math.min(100, Math.round(Number(next))));
    const distance = EMPTY_DISTANCE_CM -
      (simulationLevel / 100) * (EMPTY_DISTANCE_CM - FULL_DISTANCE_CM);
    $("rangeOutput").value = simulationLevel + "%";
    $("rangeOutput").textContent = simulationLevel + "%";
    slider.value = String(simulationLevel);
    renderValues(simulationLevel, distance, "simulation", record);
  }

  function clearHardwareReadings() {
    paintBottle(0);
    $("levelValue").textContent = "--";
    $("distanceValue").textContent = "--";
    $("bottleDistance").textContent = "-- cm";
    $("statusValue").textContent = "Not connected";
    $("statusNote").textContent = "Waiting for a live ESP32 measurement";
    $("timeValue").textContent = "--:--:--";
    $("updated").textContent = "Connect ESP32 to begin";
    $("chartSub").textContent = "Waiting for live sensor data";
    history.length = 0;
    drawChart();
  }

  function updatePortList() {
    serialSelect.innerHTML = '<option value="">Choose a port…</option>';
    knownPorts.forEach((port, index) => {
      const info = port.getInfo ? port.getInfo() : {};
      const ids = [];
      if (info.usbVendorId) ids.push("VID " + info.usbVendorId.toString(16).toUpperCase());
      if (info.usbProductId) ids.push("PID " + info.usbProductId.toString(16).toUpperCase());
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = ids.length ? "USB serial device · " + ids.join(" / ") : "Authorized serial device " + (index + 1);
      if (port === selectedPort) option.selected = true;
      serialSelect.appendChild(option);
    });
    serialConnectButton.disabled = !selectedPort || !("serial" in navigator);
  }

  async function refreshAuthorizedPorts() {
    if (!("serial" in navigator)) {
      choosePortButton.disabled = true;
      serialConnectButton.disabled = true;
      $("serialHelp").textContent =
        "Web Serial is unavailable in this browser. Use desktop Chrome or Edge to select a COM port; iPhone browsers do not expose serial ports.";
      return;
    }
    try {
      knownPorts = await navigator.serial.getPorts();
      updatePortList();
      if (!knownPorts.length) {
        $("serialHelp").textContent =
          "No previously authorized port. Choose COM port to open the browser's device picker. Desktop Chrome or Edge is required.";
      }
    } catch (error) {
      $("serialHelp").textContent = "Could not list authorized ports: " + error.message;
    }
  }

  async function chooseSerialPort() {
    if (!("serial" in navigator)) {
      setConnectionState("error", "USB serial is not supported in this browser. Try desktop Chrome or Edge.");
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      knownPorts = await navigator.serial.getPorts();
      if (!knownPorts.includes(port)) knownPorts.push(port);
      selectedPort = port;
      updatePortList();
      setConnectionState("idle", "Port selected. Choose Connect to start receiving ESP32 data.");
    } catch (error) {
      if (error.name !== "NotFoundError") {
        setConnectionState("error", "Port selection failed: " + error.message);
      }
    }
  }

  function messageFromDevice(raw) {
    let packet;
    const text = String(raw).trim();
    if (!text) return false;
    try {
      packet = JSON.parse(text);
    } catch (_) {
      const number = Number(text);
      if (Number.isFinite(number)) packet = { distance_cm: number };
      else return false;
    }
    if (typeof packet === "number") packet = { distance_cm: packet };
    if (!packet || typeof packet !== "object") return false;

    const distanceRaw = packet.distance_cm ?? packet.distance;
    const levelRaw = packet.level_percent ?? packet.fill_percent;
    const distance = Number(distanceRaw);
    const givenLevel = Number(levelRaw);
    let level;
    let measuredDistance;

    if (distanceRaw !== undefined && Number.isFinite(distance)) {
      measuredDistance = Math.max(0, distance);
      level = 100 * (EMPTY_DISTANCE_CM - measuredDistance) /
        (EMPTY_DISTANCE_CM - FULL_DISTANCE_CM);
    } else if (levelRaw !== undefined && Number.isFinite(givenLevel)) {
      level = givenLevel;
      measuredDistance = EMPTY_DISTANCE_CM -
        (Math.max(0, Math.min(100, level)) / 100) *
        (EMPTY_DISTANCE_CM - FULL_DISTANCE_CM);
    } else {
      return false;
    }

    level = Math.max(0, Math.min(100, level));
    if (distanceRaw !== undefined && Number.isFinite(distance) &&
        levelRaw !== undefined && Number.isFinite(givenLevel)) {
      level = Math.max(0, Math.min(100, givenLevel));
    }
    lastHardwareReading = Date.now();
    renderValues(level, measuredDistance, "esp32", false);
    addHistoryPoint(level);
    $("chartSub").textContent = "Live measurements from ESP32";
    $("connectionModeTag").textContent = "ESP32 CONNECTED";
    $("connectionModeTag").dataset.state = "connected";
    setConnectionState("connected", "Receiving live ESP32 data.");
    $("sensorTag").textContent = "LIVE ESP32";
    $("sensorTag").dataset.state = "connected";
    $("statusValue").textContent = "Reading normally";
    return true;
  }

  async function closeSerial() {
    const reader = serialReader;
    const port = serialPort;
    serialReader = null;
    serialConnected = false;
    if (reader) {
      try { await reader.cancel(); } catch (_) {}
      try { reader.releaseLock(); } catch (_) {}
    }
    if (port) {
      try { await port.close(); } catch (_) {}
    }
    $("serialConnectBtn").textContent = "Connect";
    if (mode === "esp32") {
      $("connectionModeTag").textContent = "NOT CONNECTED";
      $("connectionModeTag").dataset.state = "waiting";
      $("sensorTag").textContent = "WAITING FOR ESP32";
      $("sensorTag").dataset.state = "waiting";
      clearHardwareReadings();
      setConnectionState("idle", "Serial connection closed. Connect an ESP32 to show readings.");
    }
  }

  async function serialReadLoop(port, reader) {
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (serialConnected && serialReader === reader) {
        const result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        lines.forEach(line => {
          if (line.trim() && !messageFromDevice(line)) {
            setConnectionState("error", "Unrecognized serial message. Send one JSON record per line.");
          }
        });
      }
    } catch (error) {
      if (serialConnected) setConnectionState("error", "Serial read failed: " + error.message);
    } finally {
      if (serialReader === reader && serialConnected) {
        try { reader.releaseLock(); } catch (_) {}
        serialReader = null;
        serialConnected = false;
        try { await port.close(); } catch (_) {}
        if (mode === "esp32") {
          clearHardwareReadings();
          $("serialConnectBtn").textContent = "Connect";
          $("connectionModeTag").textContent = "NOT CONNECTED";
          $("connectionModeTag").dataset.state = "waiting";
          $("sensorTag").textContent = "WAITING FOR ESP32";
          $("sensorTag").dataset.state = "waiting";
          setConnectionState("error", "Serial device disconnected.");
        }
      }
    }
  }

  async function connectSerial() {
    if (serialConnected) {
      await closeSerial();
      return;
    }
    if (!selectedPort) {
      setConnectionState("error", "Choose a serial port first.");
      return;
    }
    try {
      serialPort = selectedPort;
      await serialPort.open({ baudRate: Number(baudSelect.value) });
      if (!serialPort.readable) throw new Error("The selected port has no readable stream.");
      serialReader = serialPort.readable.getReader();
      serialConnected = true;
      lastHardwareReading = Date.now();
      $("serialConnectBtn").textContent = "Disconnect";
      $("connectionModeTag").textContent = "CONNECTED · WAITING";
      $("connectionModeTag").dataset.state = "waiting";
      $("sensorTag").textContent = "WAITING FOR DATA";
      $("sensorTag").dataset.state = "waiting";
      $("updated").textContent = "Serial link open · waiting for ESP32 data";
      setConnectionState("idle", "Serial link open. Waiting for valid sensor messages.");
      serialReadLoop(serialPort, serialReader);
    } catch (error) {
      serialConnected = false;
      setConnectionState("error", "Could not open serial port: " + error.message);
      $("serialConnectBtn").textContent = "Connect";
    }
  }

  function closeWifi() {
    if (socket) {
      const oldSocket = socket;
      socket = null;
      oldSocket.onclose = null;
      oldSocket.close();
    }
    if (mode === "esp32") {
      $("connectionModeTag").textContent = "NOT CONNECTED";
      $("connectionModeTag").dataset.state = "waiting";
      $("sensorTag").textContent = "WAITING FOR ESP32";
      $("sensorTag").dataset.state = "waiting";
      clearHardwareReadings();
      wifiConnectButton.textContent = "Connect over Wi-Fi";
      setConnectionState("idle", "Wi-Fi disconnected. No hardware readings are shown.");
    }
  }

  function connectWifi() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      closeWifi();
      return;
    }
    let address;
    try {
      address = new URL(wifiUrl.value.trim());
      if (address.protocol !== "wss:" && address.protocol !== "ws:") {
        throw new Error("Use a WebSocket address beginning with wss://.");
      }
      if (location.protocol === "https:" && address.protocol === "ws:" &&
          !["localhost", "127.0.0.1"].includes(address.hostname)) {
        setConnectionState("error",
          "This dashboard is HTTPS, so it requires wss://. For plain ws://, host this page on the ESP32 or another local HTTP server.");
        return;
      }
    } catch (error) {
      setConnectionState("error", error.message || "Enter a valid WebSocket URL.");
      return;
    }

    try {
      socket = new WebSocket(address.href);
      wifiConnectButton.textContent = "Disconnect";
      $("connectionModeTag").textContent = "CONNECTING";
      $("connectionModeTag").dataset.state = "waiting";
      $("sensorTag").textContent = "WAITING FOR DATA";
      $("sensorTag").dataset.state = "waiting";
      setConnectionState("idle", "Opening Wi-Fi WebSocket. Waiting for ESP32 data.");
      socket.onopen = () => {
        if (mode !== "esp32") return;
        setConnectionState("idle", "Wi-Fi connected. Waiting for valid sensor messages.");
        $("connectionModeTag").textContent = "CONNECTED · WAITING";
      };
      socket.onmessage = async event => {
        let data = event.data;
        if (data instanceof Blob) data = await data.text();
        if (!messageFromDevice(data)) {
          setConnectionState("error", "Unrecognized Wi-Fi message. Send JSON with distance_cm or level_percent.");
        }
      };
      socket.onerror = () => {
        if (mode === "esp32") setConnectionState("error", "Wi-Fi connection failed. Check the endpoint and ESP32 server.");
      };
      socket.onclose = () => {
        if (socket && mode === "esp32") {
          socket = null;
          wifiConnectButton.textContent = "Connect over Wi-Fi";
          clearHardwareReadings();
          $("connectionModeTag").textContent = "NOT CONNECTED";
          $("connectionModeTag").dataset.state = "waiting";
          $("sensorTag").textContent = "WAITING FOR ESP32";
          $("sensorTag").dataset.state = "waiting";
          setConnectionState("error", "Wi-Fi connection closed. No hardware readings are shown.");
        }
      };
    } catch (error) {
      setConnectionState("error", "Could not start Wi-Fi connection: " + error.message);
    }
  }

  function setTransport(which) {
    const serialActive = which === "serial";
    $("serialTab").setAttribute("aria-selected", String(serialActive));
    $("wifiTab").setAttribute("aria-selected", String(!serialActive));
    $("serialPanel").hidden = !serialActive;
    $("wifiPanel").hidden = serialActive;
  }

  async function setMode(nextMode) {
    if (mode === nextMode) return;
    if (fillTimer) {
      clearInterval(fillTimer);
      fillTimer = null;
      toggleButton.querySelector("span").textContent = "Start filling";
      toggleButton.querySelector("svg").innerHTML =
        '<path fill="currentColor" d="M5 3.3c0-.6.7-.9 1.2-.6l6 4.1a1.4 1.4 0 0 1 0 2.3l-6 4.1c-.5.3-1.2 0-1.2-.6V3.3Z"/>';
    }
    if (serialConnected) await closeSerial();
    if (socket) closeWifi();

    mode = nextMode;
    const simulation = mode === "simulation";
    $("simModeBtn").setAttribute("aria-pressed", String(simulation));
    $("espModeBtn").setAttribute("aria-pressed", String(!simulation));
    connectionPanel.hidden = simulation;
    if (wiringGuide) wiringGuide.hidden = simulation;
    simulationControls.hidden = !simulation;
    $("chartSub").textContent = simulation ? "Simulated fill over time" : "Waiting for live sensor data";
    $("footnoteText").innerHTML = simulation
      ? "<strong>Simulation:</strong> adjust the slider or start the fill animation. In ESP32 mode, the dashboard waits for a real device connection."
      : "<strong>ESP32 mode:</strong> the page shows measurements only after serial or Wi-Fi data arrives. Use JSON with distance_cm or level_percent.";
    if (simulation) {
      $("sensorTag").textContent = "SIMULATION";
      $("sensorTag").dataset.state = "";
      $("statusNote").textContent = "Simulation data · hardware not connected";
      $("updated").textContent = "Demo readings · ready";
      setConnectionState("idle", "ESP32 is not connected. Simulation is active.");
      history.length = 0;
      [12, 18, 23, 31, 37, 42, 48, 53].forEach(value => history.push(value));
      lastChartPoint = 0;
      renderSimulation(simulationLevel, false);
      drawChart();
    } else {
      setConnectionState("idle", "ESP32 is not connected. No hardware readings are shown.");
      $("connectionModeTag").textContent = "NOT CONNECTED";
      $("connectionModeTag").dataset.state = "waiting";
      $("sensorTag").textContent = "WAITING FOR ESP32";
      $("sensorTag").dataset.state = "waiting";
      clearHardwareReadings();
      refreshAuthorizedPorts();
    }
  }

  $("simModeBtn").addEventListener("click", () => setMode("simulation"));
  $("espModeBtn").addEventListener("click", () => setMode("esp32"));
  $("serialTab").addEventListener("click", () => setTransport("serial"));
  $("wifiTab").addEventListener("click", () => setTransport("wifi"));
  choosePortButton.addEventListener("click", chooseSerialPort);
  serialSelect.addEventListener("change", () => {
    selectedPort = serialSelect.value === "" ? null : knownPorts[Number(serialSelect.value)];
    serialConnectButton.disabled = !selectedPort || !("serial" in navigator);
  });
  serialConnectButton.addEventListener("click", connectSerial);
  wifiConnectButton.addEventListener("click", connectWifi);

  slider.addEventListener("input", event => renderSimulation(event.target.value));
  toggleButton.addEventListener("click", () => {
    if (fillTimer) {
      clearInterval(fillTimer);
      fillTimer = null;
      toggleButton.querySelector("span").textContent = "Start filling";
      toggleButton.querySelector("svg").innerHTML =
        '<path fill="currentColor" d="M5 3.3c0-.6.7-.9 1.2-.6l6 4.1a1.4 1.4 0 0 1 0 2.3l-6 4.1c-.5.3-1.2 0-1.2-.6V3.3Z"/>';
      return;
    }
    if (simulationLevel >= 100) renderSimulation(0);
    toggleButton.querySelector("span").textContent = "Pause filling";
    toggleButton.querySelector("svg").innerHTML =
      '<path fill="currentColor" d="M4 3h3.1v10H4zM8.9 3H12v10H8.9z"/>';
    fillTimer = setInterval(() => {
      if (simulationLevel >= 100) {
        clearInterval(fillTimer);
        fillTimer = null;
        toggleButton.querySelector("span").textContent = "Start filling";
        toggleButton.querySelector("svg").innerHTML =
          '<path fill="currentColor" d="M5 3.3c0-.6.7-.9 1.2-.6l6 4.1a1.4 1.4 0 0 1 0 2.3l-6 4.1c-.5.3-1.2 0-1.2-.6V3.3Z"/>';
        return;
      }
      renderSimulation(Math.min(100, simulationLevel + 1));
    }, 550);
  });
  $("emptyBtn").addEventListener("click", () => renderSimulation(0));
  $("fullBtn").addEventListener("click", () => renderSimulation(100));

  if ("serial" in navigator) {
    navigator.serial.addEventListener("disconnect", event => {
      if (event.target === serialPort && mode === "esp32") closeSerial();
    });
  }

  setTransport("serial");
  renderSimulation(simulationLevel, false);
  drawChart();
})();
