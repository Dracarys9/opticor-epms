(function () {
  "use strict";

  const navItems = document.querySelectorAll("[data-view-target]");
  const views = document.querySelectorAll("[data-view]");
  const pageTitle = document.getElementById("page-title");
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

  const plantGrid = document.querySelector(".plant-grid");
  for (let floor = 1; floor <= 6; floor += 1) {
    const label = document.createElement("span");
    label.className = "row-label";
    label.textContent = "F" + floor;
    plantGrid.appendChild(label);
    for (let unit = 1; unit <= 12; unit += 1) {
      const cell = document.createElement("span");
      cell.textContent = String((floor - 1) * 12 + unit).padStart(2, "0");
      plantGrid.appendChild(cell);
    }
  }

  function showView(name) {
    const selected = titles[name] ? name : "dashboard";
    views.forEach((view) => {
      view.classList.toggle("active-view", view.dataset.view === selected);
    });
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.viewTarget === selected);
    });
    pageTitle.textContent = titles[selected];
  }

  navItems.forEach((item) => {
    item.addEventListener("click", function (event) {
      event.preventDefault();
      showView(item.dataset.viewTarget);
    });
  });
}());
