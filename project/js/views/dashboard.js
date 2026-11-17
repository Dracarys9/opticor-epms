(function (window) {
  "use strict";

  const workspace = () => document.getElementById("workspace");
  let unsubscribe = null;
  let clockTimer = null;

  function clockText() {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date());
  }

  function statusClass(status) {
    return status.toLowerCase();
  }

  function render(state) {
    const hasTrips = state.kpis.tripActive > 0;
    const statusText = hasTrips
      ? state.kpis.tripActive + " active trip" + (state.kpis.tripActive === 1 ? "" : "s") + " require attention"
      : "All " + state.kpis.unitsOnline + " online Opticor units operating normally";
    workspace().innerHTML = `
      <div class="status-bar ${hasTrips ? "warning-bar" : ""}"><span class="status-dot"></span><span>${statusText}</span><a href="#" data-dashboard-nav="alarms">View all alarms →</a></div>
      <header class="topbar"><h1>Dashboard</h1><div class="topbar-actions"><span class="live"><i></i> LIVE</span><span class="clock">${clockText()}</span><button class="outline-button" data-dashboard-nav="plan" type="button">▣ &nbsp; Plan Layout</button></div></header>
      <section class="dashboard-view">
        <div class="stat-grid dashboard-kpis">
          <article class="stat-card green"><span>UNITS ONLINE</span><strong>${state.kpis.unitsOnline}</strong><small>of 72 total</small></article>
          <article class="stat-card red"><span>TRIP ACTIVE</span><strong>${state.kpis.tripActive}</strong><small>Immediate attention</small></article>
          <article class="stat-card amber"><span>ALARMS ACTIVE</span><strong>${state.kpis.alarmsActive}</strong><small>Warning conditions</small></article>
          <article class="stat-card blue"><span>TOTAL POWER</span><strong>${state.kpis.totalPower.toFixed(1)}</strong><small>kW aggregate</small></article>
        </div>
        <div class="dashboard-columns">
          <div class="dashboard-left">
            <article class="panel plant-panel"><div class="panel-heading"><h2>ESP PLANT LAYOUT</h2><a href="#" data-dashboard-nav="trcc">Full TRCC Grid →</a></div><div class="plant-grid dashboard-plant-grid">${[1, 2, 3, 4, 5, 6].map((field) => `<div class="plant-field-row"><span class="row-label">F${field}</span>${state.units.filter((unit) => unit.field === field).map((unit) => `<button class="plant-unit ${statusClass(unit.status)}" data-unit-id="${unit.id}" title="${unit.name} · ${unit.status}">${unit.id.slice(-2)}</button>`).join("")}</div>`).join("")}</div><div class="legend"><span><i class="legend-online"></i>Normal</span><span><i class="legend-alarm"></i>Alarm</span><span><i class="legend-trip"></i>Trip</span><span><i class="legend-off"></i>Off</span></div></article>
            <article class="panel summary-panel"><div class="panel-heading"><h2>FIELD SUMMARY</h2><a href="#" data-dashboard-nav="power">Power Summary →</a></div></article>
          </div>
          <div class="dashboard-right">
            <article class="panel system-panel"><div class="panel-heading"><h2>SYSTEM STATUS</h2></div><dl><div><dt>Modbus RTU</dt><dd class="chip green-chip">RS-485</dd></div><div><dt>Baud Rate</dt><dd>9600 8N1</dd></div><div><dt>Data Feed</dt><dd class="chip green-chip">SIMULATED</dd></div><div><dt>Update Rate</dt><dd>2 s</dd></div><div><dt>Simulator</dt><dd class="chip green-chip"><i></i> RUNNING</dd></div></dl></article>
            <article class="panel alarms-panel"><div class="panel-heading"><h2>RECENT ALARMS</h2><a href="#" data-dashboard-nav="alarms">VIEW ALL →</a></div><div class="alarm-list">${state.alarms.map((alarm) => `<div class="alarm-row ${alarm.severity.toLowerCase()}"><b>${alarm.severity}</b><div><strong>${alarm.device}</strong><span>${alarm.message} · ${new Date(alarm.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div></div>`).join("")}</div></article>
          </div>
        </div>
      </section>`;

    workspace().querySelectorAll("[data-dashboard-nav]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("epms:navigate", { detail: item.dataset.dashboardNav }));
      });
    });
    workspace().querySelectorAll("[data-unit-id]").forEach((item) => {
      item.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("epms:select-unit", { detail: item.dataset.unitId }));
        window.dispatchEvent(new CustomEvent("epms:navigate", { detail: "trcc" }));
      });
    });
  }

  function mount() {
    if (unsubscribe) unsubscribe();
    if (clockTimer) window.clearInterval(clockTimer);
    render(window.EpmsStore.getState());
    unsubscribe = window.EpmsStore.subscribe((state) => render(state));
    clockTimer = window.setInterval(() => {
      const element = workspace().querySelector(".clock");
      if (element) element.textContent = clockText();
    }, 1000);
  }

  function unmount() {
    if (unsubscribe) unsubscribe();
    if (clockTimer) window.clearInterval(clockTimer);
    unsubscribe = null;
    clockTimer = null;
  }

  window.EpmsDashboard = { mount, unmount };
}(window));
