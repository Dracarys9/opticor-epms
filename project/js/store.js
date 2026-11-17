(function (window) {
  "use strict";

  const TICK_MS = 2000;
  const HISTORY_SIZE = 60;
  const UNIT_COUNT = 72;
  const faultNames = [
    "P-OC", "S-OC", "P-UV", "S-UV", "P-OV", "S-OV", "OPT-T", "SCR-T",
    "SCR-U", "BF", "OIL", "SAFE", "HT-IL", "BF-A", "OPT-TA", "OPT",
    "DLS", "R1", "SPARE-1", "SPARE-2"
  ];

  const alarmSeeds = [
    { severity: "TRIP", device: "OPTICOR_51", field: 5, message: "HT Interlock Open" },
    { severity: "TRIP", device: "OPTICOR_51", field: 5, message: "Primary UV Trip" },
    { severity: "ALARM", device: "OPTICOR_38", field: 4, message: "Fan Temperature" },
    { severity: "TRIP", device: "OPTICOR_23", field: 2, message: "Primary OC Trip" },
    { severity: "ALARM", device: "OPTICOR_14", field: 2, message: "Busbar Trip" },
    { severity: "TRIP", device: "OPTICOR_07", field: 1, message: "Pressure Trip" },
    { severity: "TRIP", device: "OPTICOR_07", field: 1, message: "SDI Temp High Trip" },
    { severity: "TRIP", device: "OPTICOR_34", field: 3, message: "SCR Temperature" }
  ];

  const listeners = new Set();
  let intervalId = null;
  let state;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  }

  function makeFaults() {
    return faultNames.reduce(function (faults, name) {
      faults[name] = false;
      return faults;
    }, {});
  }

  function getMetrics(active, seed) {
    if (!active) {
      return {
        primaryVoltage: 0, primaryCurrent: 0, pkSecVoltage: 0, secondaryCurrent: 0,
        power: 0, scrAngle: 0, supplyVoltage: 0, idcSetpoint: 0, cr1: 0, cr2: 0,
        sparksPerMin: 0, arcsPerMin: 0
      };
    }

    return {
      primaryVoltage: round(randomBetween(380, 420), 1),
      primaryCurrent: round(randomBetween(18, 54) + seed, 1),
      pkSecVoltage: round(randomBetween(42, 58), 2),
      secondaryCurrent: round(randomBetween(180, 640), 1),
      power: round(randomBetween(16, 42) + seed * 0.3, 2),
      scrAngle: round(randomBetween(24, 49), 1),
      supplyVoltage: round(randomBetween(398, 422), 1),
      idcSetpoint: round(randomBetween(220, 580), 1),
      cr1: round(randomBetween(72, 98), 1),
      cr2: round(randomBetween(70, 97), 1),
      sparksPerMin: round(randomBetween(0, 7), 1),
      arcsPerMin: round(randomBetween(0, 2), 1)
    };
  }

  function makeHistory(metrics, now) {
    const history = [];
    for (let point = HISTORY_SIZE - 1; point >= 0; point -= 1) {
      const variance = point === 0 ? 1 : randomBetween(0.92, 1.08);
      history.push({
        timestamp: now - point * TICK_MS,
        power: round(metrics.power * variance, 2),
        primaryVoltage: round(metrics.primaryVoltage * variance, 1),
        primaryCurrent: round(metrics.primaryCurrent * variance, 1),
        pkSecVoltage: round(metrics.pkSecVoltage * variance, 2),
        secondaryCurrent: round(metrics.secondaryCurrent * variance, 1)
      });
    }
    return history;
  }

  function makeUnit(number, now) {
    const field = Math.ceil(number / 12);
    const isSpecialTrip = [7, 23, 34, 51].includes(number);
    const isSpecialAlarm = [14, 38].includes(number);
    const isOff = !isSpecialTrip && !isSpecialAlarm && number > 58;
    const status = isSpecialTrip ? "TRIP" : isSpecialAlarm ? "ALARM" : isOff ? "OFF" : "OK";
    const active = status === "OK";
    const metrics = getMetrics(active, number % 9);
    const faults = makeFaults();

    if (status === "TRIP") {
      faults["HT-IL"] = number === 51;
      faults["P-UV"] = number === 7;
      faults["P-OC"] = number === 23;
      faults["SCR-T"] = number === 34;
    }
    if (status === "ALARM") {
      faults["OPT-T"] = number === 38;
      faults["BF"] = number === 14;
    }

    return {
      id: "unit-" + String(number).padStart(2, "0"),
      name: "Opticor-" + String(number).padStart(2, "0"),
      field: field,
      status: status,
      htStatus: active ? "HT ON" : "HT OFF",
      ...metrics,
      faults: faults,
      history: makeHistory(metrics, now)
    };
  }

  function calculateKpis(units) {
    return units.reduce(function (kpis, unit) {
      kpis.totalPower = round(kpis.totalPower + unit.power, 2);
      kpis.unitsOnline += unit.status === "OK" ? 1 : 0;
      kpis.tripActive += unit.status === "TRIP" ? 1 : 0;
      kpis.alarmsActive += unit.status === "ALARM" ? 1 : 0;
      return kpis;
    }, { unitsOnline: 0, tripActive: 0, alarmsActive: 0, totalPower: 0 });
  }

  function createInitialState() {
    const now = Date.now();
    const units = Array.from({ length: UNIT_COUNT }, function (_, index) {
      return makeUnit(index + 1, now);
    });
    const alarms = alarmSeeds.map(function (alarm, index) {
      return {
        id: "alarm-" + String(index + 1).padStart(2, "0"),
        timestamp: now - (alarmSeeds.length - index) * 2000,
        severity: alarm.severity,
        device: alarm.device,
        field: alarm.field,
        message: alarm.message,
        acknowledged: false
      };
    });

    return {
      units: units,
      alarms: alarms,
      kpis: calculateKpis(units),
      simulation: { running: true, intervalMs: TICK_MS, lastUpdated: now }
    };
  }

  function copyState() {
    return JSON.parse(JSON.stringify(state));
  }

  function notify(event) {
    const snapshot = copyState();
    listeners.forEach(function (listener) {
      listener(snapshot, event);
    });
  }

  function updateUnitMetrics(unit, now) {
    if (unit.status !== "OK") {
      return;
    }

    const next = getMetrics(true, Number(unit.id.slice(-2)) % 9);
    Object.keys(next).forEach(function (key) {
      unit[key] = next[key];
    });
    unit.history.push({
      timestamp: now,
      power: unit.power,
      primaryVoltage: unit.primaryVoltage,
      primaryCurrent: unit.primaryCurrent,
      pkSecVoltage: unit.pkSecVoltage,
      secondaryCurrent: unit.secondaryCurrent
    });
    if (unit.history.length > HISTORY_SIZE) {
      unit.history.shift();
    }
  }

  function tick() {
    if (!state.simulation.running) {
      return;
    }
    const now = Date.now();
    state.units.forEach(function (unit) {
      updateUnitMetrics(unit, now);
    });
    state.kpis = calculateKpis(state.units);
    state.simulation.lastUpdated = now;
    notify({ type: "tick", timestamp: now });
  }

  function startSimulation() {
    if (intervalId !== null) {
      return;
    }
    state.simulation.running = true;
    intervalId = window.setInterval(tick, TICK_MS);
    notify({ type: "simulation", running: true });
  }

  function stopSimulation() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    state.simulation.running = false;
    notify({ type: "simulation", running: false });
  }

  state = createInitialState();
  intervalId = window.setInterval(tick, TICK_MS);

  window.EpmsStore = {
    getState: function () {
      return copyState();
    },
    subscribe: function (listener) {
      if (typeof listener !== "function") {
        throw new TypeError("EpmsStore.subscribe expects a function");
      }
      listeners.add(listener);
      return function unsubscribe() {
        listeners.delete(listener);
      };
    },
    filterUnits: function (criteria) {
      const filter = criteria || {};
      return copyState().units.filter(function (unit) {
        const matchesField = filter.field === undefined || unit.field === Number(filter.field);
        const matchesStatus = filter.status === undefined || unit.status === filter.status;
        const search = filter.search ? String(filter.search).toLowerCase() : "";
        const matchesSearch = !search || unit.name.toLowerCase().includes(search) || unit.id.includes(search);
        return matchesField && matchesStatus && matchesSearch;
      });
    },
    acknowledgeAlarm: function (alarmId) {
      const alarm = state.alarms.find(function (item) { return item.id === alarmId; });
      if (!alarm) {
        return false;
      }
      alarm.acknowledged = true;
      notify({ type: "alarm-acknowledged", alarmId: alarmId });
      return true;
    },
    acknowledgeAll: function () {
      state.alarms.forEach(function (alarm) { alarm.acknowledged = true; });
      notify({ type: "alarms-acknowledged" });
    },
    toggleSimulation: function () {
      if (state.simulation.running) {
        stopSimulation();
      } else {
        startSimulation();
      }
      return state.simulation.running;
    },
    startSimulation: startSimulation,
    stopSimulation: stopSimulation
  };
}(window));
