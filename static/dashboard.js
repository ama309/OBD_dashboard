const socket = io.connect(window.location.origin);
let logging = false;
let logData = [];
const charts = [];

socket.on("connect", () => {
  console.log("Connected to Pi WebSocket");
});

socket.on("obd_update", (data) => {
  // Live updates
  document.getElementById("rpm").textContent = data.RPM?.toFixed(0) || "--";
  document.getElementById("speed").textContent = data.SPEED?.toFixed(0) || "--";
  document.getElementById("throttle").textContent = data.THROTTLE_POS?.toFixed(1) || "--";
  document.getElementById("turbo").textContent = data.TURBO?.toFixed(0) || "--";
  document.getElementById("gear").textContent = data.GEAR || "--";

  if (logging) logData.push({ time: Date.now(), ...data });

  updateCharts(data);
});

// -------------------------
// Graphs
// -------------------------
const metrics = [
  "RPM",
  "SPEED",
  "COOLANT_TEMP",
  "THROTTLE_POS",
  "FUEL_LEVEL",
  "GEAR",
  "TURBO",
];
const numCharts = 6;
const grid = document.getElementById("chart-grid");

function createChartContainer(index) {
  const container = document.createElement("div");
  container.className = "chart-container";

  const header = document.createElement("div");
  header.className = "chart-header";

  const title = document.createElement("span");
  title.innerText = metrics[index % metrics.length];

  const select = document.createElement("select");
  metrics.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.text = m;
    select.appendChild(opt);
  });
  select.value = metrics[index % metrics.length];

  select.addEventListener("change", (e) => {
    title.innerText = e.target.value;
    charts[index].metric = e.target.value;
    charts[index].chart.data.labels = [];
    charts[index].chart.data.datasets[0].data = [];
  });

  header.appendChild(title);
  header.appendChild(select);
  container.appendChild(header);

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  grid.appendChild(container);

  // Generate some dummy data so graphs show immediately
  const dummyLabels = Array.from({ length: 20 }, (_, i) => i.toString());
  const dummyData = Array(20).fill(0);

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: dummyLabels,
      datasets: [
        {
          label: select.value,
          data: dummyData,
          borderColor: "#58a6ff",
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { ticks: { color: "#c9d1d9" } },
      },
    },
  });

  return { chart, metric: select.value };
}

// Create 6 charts immediately
for (let i = 0; i < numCharts; i++) {
  charts.push(createChartContainer(i));
}

function updateCharts(data) {
  charts.forEach(({ chart, metric }) => {
    const value = data[metric] ?? 0;
    const now = new Date().toLocaleTimeString();

    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(value);

    if (chart.data.labels.length > 40) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }

    chart.update("none");
  });
}

// -------- Tabs -----------
function openTab(name) {
  document.querySelectorAll(".tab-content").forEach((div) => div.classList.remove("active"));
  document.querySelectorAll(".tab").forEach((btn) => btn.classList.remove("active"));
  document.getElementById(name).classList.add("active");
  event.currentTarget.classList.add("active");
}

// -------- Logging -----------
function toggleLogging() {
  logging = !logging;
  document.getElementById("log-status").textContent = logging ? "Logging..." : "Not logging";
  if (!logging && logData.length > 0) {
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "obd_log.json";
    a.click();
  }
}