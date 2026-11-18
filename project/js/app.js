(function (window) {
  "use strict";

  const titles = {
    dashboard: "Dashboard", plan: "Plan Layout", trcc: "TRCC Layout",
    trends: "Trends & Analysis", power: "Power Summary", energy: "Energy Mgmt",
    rapper: "Rapper Control", alarms: "Alarms & Events", configuration: "Configuration"
  };
  let currentView = "dashboard";

  function getTheme() {
    try { return localStorage.getItem("opticor-theme") === "dark" ? "dark" : "light"; }
    catch (error) { return "light"; }
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("opticor-theme", theme); } catch (error) {}
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.innerHTML = theme === "dark"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>';
      button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      button.title = theme === "dark" ? "Light mode" : "Dark mode";
    });
    window.dispatchEvent(new CustomEvent("epms:theme", { detail: theme }));
  }

  function closeDrawer() {
    document.body.classList.remove("drawer-open");
  }

  function addHeaderControls() {
    const topbar = document.querySelector(".workspace .topbar");
    if (!topbar) return;
    topbar.classList.add("view-enter");
  }

  function openAuthModal() {
    const modal = document.getElementById("auth-modal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector('input[name="username"]').focus();
  }

  function closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function navigate(view) {
    currentView = titles[view] ? view : "dashboard";
    window.EpmsDashboard.unmount();
    window.EpmsTrccLayout.unmount();
    window.EpmsTrends.unmount();
    window.EpmsAlarms.unmount();
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.viewTarget === currentView);
    });

    if (currentView === "dashboard") window.EpmsDashboard.mount();
    else if (currentView === "trcc") window.EpmsTrccLayout.mount();
    else if (currentView === "trends") window.EpmsTrends.mount();
    else if (currentView === "alarms") window.EpmsAlarms.mount();
    else document.getElementById("workspace").innerHTML =
      `<div class="status-bar"><span class="status-dot"></span><span>All online Opticor units operating normally</span></div>
       <header class="topbar"><h1>${titles[currentView]}</h1></header>
       <section class="placeholder-view"><div class="empty-card"><span class="empty-icon">◉</span><h2>${titles[currentView]}</h2><p>This view is ready for configuration.</p></div></section>`;
    addHeaderControls();
  }

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => { navigate(item.dataset.viewTarget); closeDrawer(); });
  });
  document.querySelector(".logout").addEventListener("click", openAuthModal);
  document.querySelector(".global-header-controls .hamburger-button").addEventListener("click", () => document.body.classList.toggle("drawer-open"));
  document.querySelector("[data-theme-toggle]").addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  document.querySelectorAll("[data-auth-close]").forEach((element) => element.addEventListener("click", closeAuthModal));
  document.getElementById("auth-form").addEventListener("submit", (event) => { event.preventDefault(); closeAuthModal(); });
  document.querySelector(".drawer-backdrop").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { closeAuthModal(); closeDrawer(); }
  });

  window.addEventListener("epms:navigate", (event) => navigate(event.detail));
  window.addEventListener("epms:select-unit", (event) => window.EpmsTrccLayout.selectUnit(event.detail));
  window.EpmsStore.subscribe((state) => {
    const unread = state.alarms.filter((alarm) => !alarm.acknowledged).length;
    document.querySelectorAll(".unread-badge").forEach((badge) => {
      badge.textContent = unread;
      badge.hidden = unread === 0;
    });
    window.requestAnimationFrame(addHeaderControls);
  });
  applyTheme(getTheme());
  window.setTimeout(() => navigate("dashboard"), 0);
}(window));
