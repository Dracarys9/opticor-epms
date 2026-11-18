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
  let thresholdEnabled = false;
  let maxLimit = "";
  let minLimit = "";
  let thresholdViolations = [];

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
    const dark = document.documentElement.dataset.theme === "dark";
    const gridColor = dark ? "#334155" : "#f1f5f9";
    const tickColor = dark ? "#94a3b8" : "#94a3b8";
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatValue(context.parsed.y)}` } } },
      scales: {
        x: { type: "linear", grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 8 }, maxTicksLimit: 7 }, title: { display: true, text: "Time", color: tickColor, font: { size: 8 } } },
        y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 8 } }, title: { display: true, text: parameters[parameter].label, color: tickColor, font: { size: 8 } } }
      }
    };
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function thresholdRowsHtml() {
    if (!thresholdViolations.length) {
      return '<div class="threshold-empty"><span>✓</span><p>No threshold violations recorded. Configure thresholds above to enable alerting.</p></div>';
    }
    return '<div class="threshold-list">' + thresholdViolations.slice(0, 20).map((item) =>
      `<div class="threshold-row"><span>TRIP</span><div><strong>${item.unit}</strong><small>${item.parameter}: ${formatValue(item.value)} ${item.unitSuffix} · ${item.limit}</small></div><time>${new Date(item.timestamp).toLocaleTimeString()}</time></div>`
    ).join("") + '</div>';
  }

  function renderThresholdPanel() {
    const panel = document.querySelector(".threshold-panel");
    if (!panel) return;
    const heading = panel.querySelector(".threshold-heading");
    const badge = heading ? heading.querySelector("h2 b") : null;
    if (badge) badge.textContent = thresholdViolations.length;
    const list = panel.querySelector(".threshold-empty, .threshold-list");
    if (list) list.outerHTML = thresholdRowsHtml();
  }

  function checkThresholds(state) {
    if (!thresholdEnabled) return;
    const definition = parameters[parameter];
    const selected = selectedUnits(state);
    const now = Date.now();
    selected.forEach((unit) => {
      const value = unit[definition.field];
      const maxExceeded = maxLimit !== "" && value > Number(maxLimit);
      const minExceeded = minLimit !== "" && value < Number(minLimit);
      if (maxExceeded || minExceeded) {
        thresholdViolations.unshift({
          timestamp: now,
          unit: unit.name,
          parameter: definition.label,
          value: value,
          unitSuffix: definition.unit,
          limit: maxExceeded ? `Above max ${maxLimit}` : `Below min ${minLimit}`
        });
      }
    });
    if (thresholdViolations.length > 100) thresholdViolations.length = 100;
    renderThresholdPanel();
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
            <button class="trend-tool-button" data-trend-action="thresholds" type="button">☷ Thresholds</button><button class="trend-tool-button" data-trend-action="refresh" type="button">↻ Refresh</button>
          </div>
          <article class="panel chart-panel"><div class="chart-heading"><div><h2>${mode === "curve" ? "V-I CURVE" : parameters[parameter].label.toUpperCase()}</h2><span>${mode === "curve" ? "Primary voltage vs. primary current" : `Last ${timeRange} minutes • 2s resolution`}</span></div><div class="chart-legend">${units.map((unit, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${unit.name}</span>`).join("")}</div></div><div class="chart-wrap">${canChart ? '<canvas id="trend-chart" aria-label="Trend chart"></canvas>' : '<div class="chart-fallback">Chart.js could not be loaded. Check the network connection and reload the page.</div>'}</div></article>
          <article class="panel threshold-panel"><div class="threshold-heading"><h2>THRESHOLD ALERTS <b>${thresholdViolations.length}</b></h2><div><button type="button" data-trend-action="export">＋ Export CSV</button><button type="button" data-trend-action="clear-log">Clear Log</button></div></div>${thresholdRowsHtml()}</article>
        </div>
      </section>
      <div class="threshold-modal" id="threshold-modal" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="threshold-modal-backdrop" data-threshold-close></div>
        <form class="threshold-modal-card" id="threshold-form">
          <button class="threshold-modal-close" type="button" data-threshold-close aria-label="Close thresholds">×</button>
          <p class="threshold-modal-eyebrow">ANALYTICS SAFETY LIMITS</p><h2>Configure Thresholds</h2>
          <label class="threshold-enable"><input type="checkbox" id="threshold-enabled" ${thresholdEnabled ? "checked" : ""}> Enable live threshold alerting</label>
          <div class="threshold-fields"><label>Maximum ${parameters[parameter].unit}<input type="number" id="threshold-max" value="${maxLimit}" placeholder="Max ${parameters[parameter].unit}" step="any"></label><label>Minimum ${parameters[parameter].unit}<input type="number" id="threshold-min" value="${minLimit}" placeholder="Min ${parameters[parameter].unit}" step="any"></label></div>
          <p class="threshold-active">Active parameter: <strong>${parameters[parameter].label}</strong></p>
          <button class="threshold-save" type="submit">Apply Thresholds</button>
        </form>
      </div>`;

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
    document.querySelector("[data-trend-action='thresholds']").addEventListener("click", () => {
      const modal = document.getElementById("threshold-modal");
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    });
    document.querySelectorAll("[data-threshold-close]").forEach((item) => item.addEventListener("click", () => {
      const modal = document.getElementById("threshold-modal");
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }));
    document.getElementById("threshold-form").addEventListener("submit", (event) => {
      event.preventDefault();
      thresholdEnabled = document.getElementById("threshold-enabled").checked;
      maxLimit = document.getElementById("threshold-max").value;
      minLimit = document.getElementById("threshold-min").value;
      document.getElementById("threshold-modal").classList.remove("open");
      document.getElementById("threshold-modal").setAttribute("aria-hidden", "true");
      checkThresholds(window.EpmsStore.getState());
    });
    document.querySelector("[data-trend-action='clear-log']").addEventListener("click", () => {
      thresholdViolations = [];
      renderThresholdPanel();
    });
    document.querySelector("[data-trend-action='export']").addEventListener("click", () => {
      const state = window.EpmsStore.getState();
      const units = selectedUnits(state);
      const rows = [["Timestamp", ...units.map((unit) => unit.name)]];
      const points = Math.max(1, Math.min(60, timeRange * 30));
      const length = Math.max(...units.map((unit) => unit.history.slice(-points).length), 0);
      for (let index = 0; index < length; index += 1) {
        const first = units.find((unit) => unit.history.slice(-points)[index]);
        const sample = first ? first.history.slice(-points)[index] : null;
        rows.push([
          sample ? new Date(sample.timestamp).toISOString() : "",
          ...units.map((unit) => {
            const history = unit.history.slice(-points);
            return history[index] ? history[index][parameters[parameter].field] : "";
          })
        ]);
      }
      downloadCsv("opticor-trends-export.csv", rows);
    });
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

  function applyThemeToChart() {
    if (!chart) return;
    const dark = document.documentElement.dataset.theme === "dark";
    const gridColor = dark ? "#334155" : "#f1f5f9";
    const tickColor = "#94a3b8";
    ["x", "y"].forEach((axis) => {
      chart.options.scales[axis].grid.color = gridColor;
      chart.options.scales[axis].ticks.color = tickColor;
      chart.options.scales[axis].title.color = tickColor;
    });
    chart.update("none");
  }

  function mount() {
    if (unsubscribe) unsubscribe();
    render(window.EpmsStore.getState());
    unsubscribe = window.EpmsStore.subscribe((state) => {
      if (document.querySelector(".trends-view")) {
        updateChart(state);
        checkThresholds(state);
      }
    });
    window.addEventListener("epms:theme", applyThemeToChart);
  }

  function unmount() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    window.removeEventListener("epms:theme", applyThemeToChart);
    if (chart) chart.destroy();
    chart = null;
  }

  window.EpmsTrends = { mount, unmount };
}(window));
