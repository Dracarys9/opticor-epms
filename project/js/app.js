(function (window) {
  "use strict";

  const titles = {
    dashboard: "Dashboard",
    plan: "Plan Layout",
    trcc: "TRCC Layout",
    trends: "Trends & Analysis",
    power: "Power Summary",
    energy: "Energy Mgmt",
    rapper: "Rapper Control",
    alarms: "Alarms & Events",
    configuration: "Configuration"
  };
  let currentView = "dashboard";

  function navigate(view) {
    currentView = titles[view] ? view : "dashboard";
    window.EpmsDashboard.unmount();
    window.EpmsTrccLayout.unmount();
    window.EpmsTrends.unmount();
    window.EpmsAlarms.unmount();
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.viewTarget === currentView);
    });

    if (currentView === "dashboard") {
      window.EpmsDashboard.mount();
    } else if (currentView === "trcc") {
      window.EpmsTrccLayout.mount();
    } else if (currentView === "trends") {
      window.EpmsTrends.mount();
    } else if (currentView === "alarms") {
      window.EpmsAlarms.mount();
    } else {
      document.getElementById("workspace").innerHTML =
        `<div class="status-bar"><span class="status-dot"></span><span>All online Opticor units operating normally</span></div>
        <header class="topbar"><h1>${titles[currentView]}</h1></header>
        <section class="placeholder-view"><div class="empty-card"><span class="empty-icon">◉</span><h2>${titles[currentView]}</h2><p>This view is ready for configuration.</p></div></section>`;
    }
  }

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => navigate(item.dataset.viewTarget));
  });
  window.addEventListener("epms:navigate", (event) => navigate(event.detail));
  window.addEventListener("epms:select-unit", (event) => window.EpmsTrccLayout.selectUnit(event.detail));
  window.EpmsStore.subscribe((state) => {
    const unread = state.alarms.filter((alarm) => !alarm.acknowledged).length;
    document.querySelectorAll(".unread-badge").forEach((badge) => {
      badge.textContent = unread;
      badge.hidden = unread === 0;
    });
  });
  window.setTimeout(() => navigate("dashboard"), 0);
}(window));
