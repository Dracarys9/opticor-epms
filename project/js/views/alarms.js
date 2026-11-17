(function (window) {
  "use strict";

  let unsubscribe = null;
  let severity = "ALL";
  let device = "ALL";
  let status = "ALL";
  let search = "";
  let sortKey = "timestamp";
  let sortDirection = "desc";

  function timeText(timestamp) {
    return new Date(timestamp).toLocaleString([], {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }

  function filteredAlarms(state) {
    return state.alarms.filter((alarm) => {
      const matchesSeverity = severity === "ALL" || alarm.severity === severity;
      const matchesDevice = device === "ALL" || alarm.device === device;
      const matchesStatus = status === "ALL" || (status === "ACKNOWLEDGED" ? alarm.acknowledged : !alarm.acknowledged);
      const query = search.toLowerCase();
      const matchesSearch = !query || [alarm.device, alarm.message, `field ${alarm.field}`, alarm.severity].some((value) => value.toLowerCase().includes(query));
      return matchesSeverity && matchesDevice && matchesStatus && matchesSearch;
    }).sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      const result = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;
      return sortDirection === "asc" ? result : -result;
    });
  }

  function render(state) {
    const activeTrips = state.alarms.filter((alarm) => alarm.severity === "TRIP" && !alarm.acknowledged).length;
    const activeAlarms = state.alarms.filter((alarm) => alarm.severity === "ALARM" && !alarm.acknowledged).length;
    const acknowledged = state.alarms.filter((alarm) => alarm.acknowledged).length;
    const devices = [...new Set(state.alarms.map((alarm) => alarm.device))].sort();
    const rows = filteredAlarms(state);

    document.getElementById("workspace").innerHTML = `
      <header class="topbar alarms-topbar"><h1>Alarms &amp; Notifications</h1><div class="alarms-header-actions"><span class="alarm-live"><i></i> Live • 2s refresh</span><button class="ack-all-button" type="button">Acknowledge All Active</button></div></header>
      <section class="alarms-view">
        <div class="alarm-kpis">
          <article class="alarm-kpi blue"><span>TOTAL ALARMS</span><strong>${state.alarms.length}</strong><small>In log</small></article>
          <article class="alarm-kpi red"><span>ACTIVE TRIPS</span><strong>${activeTrips}</strong><small>Unacknowledged</small></article>
          <article class="alarm-kpi amber"><span>ACTIVE ALARMS</span><strong>${activeAlarms}</strong><small>Unacknowledged</small></article>
          <article class="alarm-kpi green"><span>ACKNOWLEDGED</span><strong>${acknowledged}</strong><small>All time</small></article>
        </div>
        <div class="alarm-filterbar">
          <div class="alarm-filter-group"><label>SEVERITY</label><div class="alarm-pills">${["ALL", "TRIP", "ALARM"].map((item) => `<button class="${severity === item ? "selected " : ""}${item.toLowerCase()}" data-severity="${item}" type="button">${item === "ALL" ? "All" : item}</button>`).join("")}</div></div>
          <div class="alarm-filter-group"><label>DEVICE</label><select id="alarm-device"><option value="ALL">All Devices</option>${devices.map((item) => `<option value="${item}">${item}</option>`).join("")}</select></div>
          <div class="alarm-filter-group"><label>STATUS</label><select id="alarm-status"><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="ACKNOWLEDGED">Acknowledged</option></select></div>
          <input class="alarm-search" id="alarm-search" type="search" placeholder="Search device, field, message..." value="${search}" aria-label="Search alarms"><span class="alarm-row-count">${rows.length} rows</span>
        </div>
        <div class="alarm-table-wrap"><table class="alarm-table"><thead><tr>${[["timestamp", "TIMESTAMP"], ["severity", "SEVERITY"], ["device", "DEVICE"], ["field", "FIELD / FAULT TYPE"], ["message", "MESSAGE"], ["acknowledged", "STATUS"]].map(([key, label]) => `<th><button data-sort="${key}" type="button">${label}<span>${sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}</span></button></th>`).join("")}<th>ACTION</th></tr></thead><tbody>${rows.length ? rows.map((alarm) => `<tr class="${alarm.acknowledged ? "" : `unacknowledged ${alarm.severity.toLowerCase()}`}"><td class="alarm-time">${timeText(alarm.timestamp)}</td><td><span class="severity-badge ${alarm.severity.toLowerCase()}">${alarm.severity}</span></td><td class="alarm-device">${alarm.device}</td><td>FIELD ${alarm.field} / ${alarm.message}</td><td>${alarm.device} ${alarm.message} activated</td><td><span class="alarm-status ${alarm.acknowledged ? "acknowledged" : "active"}">${alarm.acknowledged ? "Acknowledged" : "Active"}</span></td><td><button class="ack-button" data-ack="${alarm.id}" type="button" ${alarm.acknowledged ? "disabled" : ""}>Ack</button></td></tr>`).join("") : `<tr><td class="alarm-no-results" colspan="7">No alarms match the selected filters.</td></tr>`}</tbody></table></div>
      </section>`;

    document.getElementById("alarm-device").value = device;
    document.getElementById("alarm-status").value = status;
    document.querySelector(".ack-all-button").addEventListener("click", () => window.EpmsStore.acknowledgeAll());
    document.querySelectorAll("[data-severity]").forEach((button) => button.addEventListener("click", () => {
      severity = button.dataset.severity;
      render(window.EpmsStore.getState());
    }));
    document.getElementById("alarm-device").addEventListener("change", (event) => { device = event.target.value; render(window.EpmsStore.getState()); });
    document.getElementById("alarm-status").addEventListener("change", (event) => { status = event.target.value; render(window.EpmsStore.getState()); });
    document.getElementById("alarm-search").addEventListener("input", (event) => { search = event.target.value; render(window.EpmsStore.getState()); });
    document.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
      const nextKey = button.dataset.sort;
      if (sortKey === nextKey) sortDirection = sortDirection === "asc" ? "desc" : "asc";
      else { sortKey = nextKey; sortDirection = "asc"; }
      render(window.EpmsStore.getState());
    }));
    document.querySelectorAll("[data-ack]").forEach((button) => button.addEventListener("click", () => window.EpmsStore.acknowledgeAlarm(button.dataset.ack)));
  }

  function mount() {
    if (unsubscribe) unsubscribe();
    render(window.EpmsStore.getState());
    unsubscribe = window.EpmsStore.subscribe((state) => {
      if (document.querySelector(".alarms-view")) render(state);
    });
  }

  function unmount() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  window.EpmsAlarms = { mount, unmount };
}(window));
