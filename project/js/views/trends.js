(function (window) {
  "use strict";

  const colors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#9333ea", "#0891b2"];
  const parameters = {
    power: { label: "Power (kW)", field: "power", unit: "kW" },
    primaryVoltage: { label: "Primary Voltage (V)", field: "primaryVoltage", unit: "V" },
    secondaryCurrent: { label: "Secondary Current (mA)", field: "secondaryCurrent", unit: "mA" }
  };
  const defaultSelection = ["unit-03", "unit-05", "unit-07", "unit-09", "unit-14", "unit-43"];
  let selectedIds = new Set(defaultSelection);
  let parameter = "power";
  let mode = "trend";
  let timeRange = 2;
  let search = "";
  let chart = null;
  let unsubscribe = null;

  function statusClass(status) {
    return status.toLowerCase();
  }

  function formatValue(value) {
    return Number(value || 0).toFixed(1);
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function selectedUnits(state) {
    return state.units.filter((unit) => selectedIds.has(unit.id));
  }

  function unitRows(state) {
    const filtered = state.units.filter((unit) => {
      return !search || unit.name.toLowerCase().includes(search.toLowerCase());
    });
    return [1, 2, 3, 4, 5, 6].map((field) => {
      const units = filtered.filter((unit) => unit.field === field);
      const start = String((field - 1) * 12 + 1).padStart(2, "0");
      const end = String(field * 12).padStart(2, "0");
      return `<section class="trend-field"><h3>FIELD ${field} <span>(OPTICOR ${start}-${end})</span></h3>${units.map((unit) => `
        <label class="trend-unit-row">
          <input type="checkbox" data-trend-unit="${unit.id}" ${selectedIds.has(unit.id) ? "checked" : ""}>
          <i class="trend-status-dot ${statusClass(unit.status)}"></i>
          <span>${unit.name}</span>
          <b class="trend-status-pill ${statusClass(unit.status)}">${unit.status}</b>
        </label>`).join("")}</section>`;
    }).join("");
  }

  function trendDatasets(units) {
    const points = Math.max(1, Math.min(60, timeRange * 30));
    return units.map((unit, index) => {
      const history = unit.history.slice(-points);
      return {
        label: unit.name,
        data: history.map((entry) => ({ x: entry.timestamp, y: entry[parameters[parameter].field] })),
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.25
      };
    });
  }

  function curveDatasets(units) {
    return units.map((unit, index) => ({
      label: unit.name,
      data: unit.history.slice(-30).map((entry) => ({ x: entry.primaryVoltage, y: entry.primaryCurrent })),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length],
      borderWidth: 1.5,
      pointRadius: 1.5,
      showLine: true,
      tension: 0.25
    }));
  }

  function updateChart(state) {
    if (!chart) return;
    const units = selectedUnits(state);
    const isCurve = mode === "curve";
    chart.data.datasets = isCurve ? curveDatasets(units) : trendDatasets(units);
    chart.options.scales.x.title.text = isCurve ? "Primary Voltage (V)" : "Time";
    chart.options.scales.y.title.text = isCurve ? "Primary Current (A)" : parameters[parameter].label;
    chart.options.plugins.legend.display = false;
    chart.update("none");
  }

  function chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatValue(context.parsed.y)}` } } },
      scales: {
        x: { type: "linear", grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 8 }, maxTicksLimit: 7 }, title: { display: true, text: "Time", color: "#94a3b8", font: { size: 8 } } },
        y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 8 } }, title: { display: true, text: parameters[parameter].label, color: "#94a3b8", font: { size: 8 } } }
      }
    };
  }

  function render(state) {
    const units = selectedUnits(state);
    const canChart = typeof window.Chart === "function";
    document.getElementById("workspace").innerHTML = `
      <header class="topbar trends-topbar"><h1>Trends &amp; Analysis</h1><div class="trends-header-meta"><span class="auto-pill"><i></i> Auto-refreshing</span><span class="selected-count">${units.length} units selected</span></div></header>
      <section class="trends-view">
        <aside class="trend-selector panel">
          <div class="trend-selector-title">SELECT OPTICOR UNITS</div>
          <input class="trend-search" type="search" placeholder="Search Opticor-01..." value="${search}" aria-label="Search Opticor units">
          <div class="trend-actions"><button type="button" data-trend-action="clear">Clear</button><button type="button" data-trend-action="trips">Trips</button></div>
          <div class="trend-unit-list">${unitRows(state)}</div>
        </aside>
        <div class="trend-analytics">
          <div class="trend-toolbar">
            <div class="trend-toggle"><button class="${mode === "trend" ? "selected" : ""}" data-mode="trend" type="button">Trend</button><button class="${mode === "curve" ? "selected" : ""}" data-mode="curve" type="button">VI Curve</button></div>
            <label>Parameter <select id="trend-parameter"><option value="power">Power (kW)</option><option value="primaryVoltage">Primary Voltage (V)</option><option value="secondaryCurrent">Secondary Current (mA)</option></select></label>
            <div class="range-toggle">${[1, 2, 4].map((range) => `<button class="${timeRange === range ? "selected" : ""}" data-range="${range}" type="button">${range} min</button>`).join("")}</div>
            <button class="trend-tool-button" type="button">☷ Thresholds</button><button class="trend-tool-button" data-trend-action="refresh" type="button">↻ Refresh</button>
          </div>
          <article class="panel chart-panel"><div class="chart-heading"><div><h2>${mode === "curve" ? "V-I CURVE" : parameters[parameter].label.toUpperCase()}</h2><span>${mode === "curve" ? "Primary voltage vs. primary current" : `Last ${timeRange} minutes • 2s resolution`}</span></div><div class="chart-legend">${units.map((unit, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${unit.name}</span>`).join("")}</div></div><div class="chart-wrap">${canChart ? '<canvas id="trend-chart" aria-label="Trend chart"></canvas>' : '<div class="chart-fallback">Chart.js could not be loaded. Check the network connection and reload the page.</div>'}</div></article>
          <article class="panel threshold-panel"><div class="threshold-heading"><h2>THRESHOLD ALERTS <b>0</b></h2><div><button type="button">＋ Export CSV</button><button type="button">Clear Log</button></div></div><div class="threshold-empty"><span>✓</span><p>No threshold violations recorded. Configure thresholds above to enable alerting.</p></div></article>
        </div>
      </section>`;

    const parameterSelect = document.getElementById("trend-parameter");
    parameterSelect.value = parameter;
    parameterSelect.addEventListener("change", (event) => {
      parameter = event.target.value;
      render(window.EpmsStore.getState());
    });
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      mode = button.dataset.mode;
      render(window.EpmsStore.getState());
    }));
    document.querySelectorAll("[data-range]").forEach((button) => button.addEventListener("click", () => {
      timeRange = Number(button.dataset.range);
      render(window.EpmsStore.getState());
    }));
    document.querySelector(".trend-search").addEventListener("input", (event) => {
      search = event.target.value;
      document.querySelector(".trend-unit-list").innerHTML = unitRows(window.EpmsStore.getState());
      bindUnitChecks();
    });
    document.querySelector("[data-trend-action='clear']").addEventListener("click", () => {
      selectedIds.clear();
      render(window.EpmsStore.getState());
    });
    document.querySelector("[data-trend-action='trips']").addEventListener("click", () => {
      selectedIds = new Set(window.EpmsStore.getState().units.filter((unit) => unit.status === "TRIP").map((unit) => unit.id));
      render(window.EpmsStore.getState());
    });
    document.querySelector("[data-trend-action='refresh']").addEventListener("click", () => updateChart(window.EpmsStore.getState()));
    bindUnitChecks();
    if (canChart) {
      chart = new window.Chart(document.getElementById("trend-chart").getContext("2d"), { type: mode === "curve" ? "scatter" : "line", data: { datasets: mode === "curve" ? curveDatasets(units) : trendDatasets(units) }, options: chartOptions() });
    }
  }

  function bindUnitChecks() {
    document.querySelectorAll("[data-trend-unit]").forEach((checkbox) => checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedIds.add(checkbox.dataset.trendUnit);
      else selectedIds.delete(checkbox.dataset.trendUnit);
      render(window.EpmsStore.getState());
    }));
  }

  function mount() {
    if (unsubscribe) unsubscribe();
    render(window.EpmsStore.getState());
    unsubscribe = window.EpmsStore.subscribe((state) => {
      if (document.querySelector(".trends-view")) updateChart(state);
    });
  }

  function unmount() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (chart) chart.destroy();
    chart = null;
  }

  window.EpmsTrends = { mount, unmount };
}(window));
