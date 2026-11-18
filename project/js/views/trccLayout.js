(function (window) {
  "use strict";

  const faultNames = ["P-OC", "S-OC", "P-UV", "S-UV", "P-OV", "S-OV", "OPT-T", "SCR-T", "SCR-U", "BF", "OIL", "SAFE", "HT-IL", "BF-A", "OPT-TA", "OPT", "DLS", "R1", "SPARE-1", "SPARE-2"];
  const metrics = [
    ["primaryVoltage", "Primary Voltage", "V"], ["primaryCurrent", "Primary Current", "A"],
    ["pkSecVoltage", "Pk Sec. Voltage", "kV"], ["secondaryCurrent", "Secondary Current", "mA"],
    ["power", "Power", "kW"], ["scrAngle", "SCR Angle", "deg"], ["supplyVoltage", "Supply Voltage", "V"],
    ["idcSetpoint", "IDC Setpoint", "mA"], ["cr1", "CR-1", "%"], ["cr2", "CR-2", "%"],
    ["sparksPerMin", "Sparks/Min", ""], ["arcsPerMin", "Arcs/Min", ""]
  ];
  let selectedId = "unit-03";
  let metricKey = "power";
  let activeFilter = "ALL";
  let unsubscribe = null;

  function value(unit, key) {
    const metric = metrics.find((item) => item[0] === key);
    return unit[key].toFixed(metric && ["power", "pkSecVoltage"].includes(key) ? 1 : 0) + (metric ? " " + metric[2] : "");
  }

  function render(state) {
    const selected = state.units.find((unit) => unit.id === selectedId) || state.units[2];
    selectedId = selected.id;
    const counts = { ALL: state.units.length, TRIP: 0, ALARM: 0, OK: 0, OFF: 0 };
    state.units.forEach((unit) => { counts[unit.status] += 1; });
    document.getElementById("workspace").innerHTML = `
      <header class="topbar trcc-topbar"><h1>TRCC Layout</h1><div class="topbar-actions"><span class="live"><i></i> LIVE</span><span>Selected: <b>${selected.name}</b></span><a href="#" data-trcc-nav="dashboard">← Dashboard</a></div></header>
      <section class="trcc-view">
        <div class="trcc-filterbar"><div class="filter-pills">${["ALL", "TRIP", "ALARM", "OK", "OFF"].map((status) => `<button class="filter-pill ${status === activeFilter ? "selected" : ""}" data-filter="${status}">${status === "ALL" ? "All" : status} <b>(${counts[status]})</b></button>`).join("")}</div><label class="metric-select">Value <select id="metric-select"><option value="power">Power (kW)</option><option value="primaryVoltage">Primary Voltage</option><option value="secondaryCurrent">Secondary Current</option></select></label><div class="trcc-legend"><span><i class="legend-online"></i>OK</span><span><i class="legend-alarm"></i>Alarm</span><span><i class="legend-trip"></i>Trip</span><span><i class="legend-off"></i>Off</span></div></div>
        <div class="trcc-split"><div class="field-list">${[1, 2, 3, 4, 5, 6].map((field) => `<section class="field-section"><h2>FIELD ${field} <span>(OPTICOR ${String((field - 1) * 12 + 1).padStart(2, "0")}-${String(field * 12).padStart(2, "0")})</span></h2><div class="field-grid">${state.units.filter((unit) => unit.field === field).map((unit) => `<button class="unit-tile ${unit.status.toLowerCase()} ${unit.id === selected.id ? "selected" : ""}" data-unit-id="${unit.id}" ${activeFilter !== "ALL" && unit.status !== activeFilter ? "hidden" : ""}><span class="unit-dot"></span><strong>${unit.id.slice(-2)}</strong><small>${value(unit, metricKey)}</small></button>`).join("")}</div></section>`).join("")}</div>
          <aside class="inspector"><div class="inspector-head"><div><h2>${selected.name}</h2><div class="inspector-pills"><span class="status-pill ${selected.status.toLowerCase()}">${selected.status}</span><span class="status-pill">${selected.htStatus}</span></div></div><button class="trends-button" type="button">⌁ Trends</button></div><h3>ELECTRICAL</h3><div class="electrical-grid">${metrics.map((metric) => `<div class="metric-card"><span>${metric[1]}</span><strong>${value(selected, metric[0])}</strong></div>`).join("")}</div><h3>FAULT STATUS</h3><div class="fault-grid">${faultNames.map((fault) => `<span class="fault-pill ${selected.faults[fault] ? "active" : ""}">${fault}<b>${selected.faults[fault] ? "ON" : "OK"}</b></span>`).join("")}</div><section class="simulator-controls"><h3>SIMULATOR CONTROLS</h3><div><button type="button" data-sim-action="power">${selected.status === "OFF" ? "Toggle Power (ON)" : "Toggle Power (OFF)"}</button><button type="button" data-sim-action="inject">Inject Fault</button><button type="button" data-sim-action="clear">Clear Faults</button></div></section></aside>
        </div>
      </section>`;

    document.getElementById("metric-select").value = metricKey;
    document.querySelectorAll("[data-trcc-nav]").forEach((item) => item.addEventListener("click", (event) => {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("epms:navigate", { detail: item.dataset.trccNav }));
    }));
    document.querySelectorAll("[data-unit-id]").forEach((item) => item.addEventListener("click", () => {
      selectedId = item.dataset.unitId;
      render(window.EpmsStore.getState());
    }));
    document.getElementById("metric-select").addEventListener("change", (event) => {
      metricKey = event.target.value;
      render(window.EpmsStore.getState());
    });
    document.querySelectorAll("[data-filter]").forEach((item) => item.addEventListener("click", () => {
      activeFilter = item.dataset.filter;
      render(window.EpmsStore.getState());
    }));
    document.querySelectorAll("[data-sim-action]").forEach((item) => item.addEventListener("click", () => {
      if (item.dataset.simAction === "power") window.EpmsStore.toggleUnitPower(selectedId);
      if (item.dataset.simAction === "inject") window.EpmsStore.injectUnitFault(selectedId);
      if (item.dataset.simAction === "clear") window.EpmsStore.clearUnitFaults(selectedId);
    }));
  }

  function mount() {
    if (unsubscribe) unsubscribe();
    render(window.EpmsStore.getState());
    unsubscribe = window.EpmsStore.subscribe((state) => render(state));
  }

  function unmount() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  window.EpmsTrccLayout = { mount, unmount, selectUnit: (id) => { selectedId = id; } };
}(window));
