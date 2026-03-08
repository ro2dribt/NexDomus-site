const CONTROL_USER_KEY = "nexdomus_control_user";
const CONTROL_STATE_KEY = "nexdomus_control_state";
const CONTROL_CUSTOM_SCENES_KEY = "nexdomus_control_custom_scenes";

const LIGHTS_META = [
  { id: "sala", defaultBrightness: 55 },
  { id: "cozinha", defaultBrightness: 70 },
  { id: "quarto", defaultBrightness: 35 },
  { id: "entrada", defaultBrightness: 40 },
  { id: "wc", defaultBrightness: 30 },
  { id: "escritorio_luz", defaultBrightness: 60 }
];

const SOCKETS_META = [
  { id: "tv", defaultWatts: 180, min: 50, max: 800 },
  { id: "consola", defaultWatts: 120, min: 30, max: 500 },
  { id: "frigorifico", defaultWatts: 150, min: 80, max: 600 },
  { id: "cafeteira", defaultWatts: 950, min: 100, max: 1800 },
  { id: "maquina", defaultWatts: 900, min: 200, max: 2400 },
  { id: "secadora", defaultWatts: 1200, min: 300, max: 2600 },
  { id: "escritorio", defaultWatts: 130, min: 40, max: 600 },
  { id: "pc", defaultWatts: 280, min: 80, max: 900 },
  { id: "carregadores", defaultWatts: 60, min: 20, max: 300 }
];

const LIGHT_IDS = LIGHTS_META.map((item) => item.id);
const SOCKET_IDS = SOCKETS_META.map((item) => item.id);

const DEFAULT_SCENES = [
  {
    id: "cinema",
    name: "Cena Cinema",
    builtin: true,
    config: {
      lights: { sala: 18, cozinha: 0, quarto: 0, entrada: 10, wc: 0, escritorio_luz: 0 },
      socketsOn: { tv: true, consola: true, frigorifico: true, cafeteira: false, maquina: false, secadora: false, escritorio: false, pc: false, carregadores: true },
      estores: 0,
      temperature: 21
    }
  },
  {
    id: "jantar",
    name: "Cena Jantar",
    builtin: true,
    config: {
      lights: { sala: 55, cozinha: 65, quarto: 10, entrada: 30, wc: 20, escritorio_luz: 15 },
      socketsOn: { tv: false, consola: false, frigorifico: true, cafeteira: true, maquina: false, secadora: false, escritorio: true, pc: false, carregadores: true },
      estores: 35,
      temperature: 22
    }
  },
  {
    id: "ausente",
    name: "Modo Ausente",
    builtin: true,
    config: {
      lights: { sala: 0, cozinha: 0, quarto: 0, entrada: 0, wc: 0, escritorio_luz: 0 },
      socketsOn: { tv: false, consola: false, frigorifico: true, cafeteira: false, maquina: false, secadora: false, escritorio: false, pc: false, carregadores: false },
      estores: 0,
      temperature: 19
    }
  }
];

function parseJSON(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentFile() {
  const parts = window.location.pathname.split("/");
  return parts[parts.length - 1] || "index.html";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function eur(value) {
  return `${value.toFixed(2)} EUR`;
}

function getUser() {
  return parseJSON(localStorage.getItem(CONTROL_USER_KEY), null);
}

function setUser(user) {
  localStorage.setItem(CONTROL_USER_KEY, JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem(CONTROL_USER_KEY);
}

function createDefaultState() {
  const lights = {};
  LIGHTS_META.forEach((item) => {
    lights[item.id] = { on: item.defaultBrightness > 0, brightness: item.defaultBrightness };
  });

  const sockets = {};
  SOCKETS_META.forEach((item) => {
    sockets[item.id] = { on: item.id === "tv" || item.id === "frigorifico", watts: item.defaultWatts };
  });

  return {
    lights,
    sockets,
    estores: 45,
    temperature: 22,
    settings: {
      priceKwh: 0.23
    },
    energy: {
      dayKey: todayKey(),
      kwhToday: 0,
      lastSampleMs: Date.now(),
      hourlyKwh: Array.from({ length: 24 }, () => 0)
    }
  };
}

function loadState() {
  const saved = parseJSON(localStorage.getItem(CONTROL_STATE_KEY), null);
  const base = createDefaultState();
  if (!saved) return base;

  const lights = {};
  LIGHT_IDS.forEach((id) => {
    lights[id] = {
      on: Boolean(saved.lights?.[id]?.on ?? base.lights[id].on),
      brightness: clamp(Number(saved.lights?.[id]?.brightness ?? base.lights[id].brightness), 0, 100)
    };
  });

  const sockets = {};
  SOCKETS_META.forEach((item) => {
    sockets[item.id] = {
      on: Boolean(saved.sockets?.[item.id]?.on ?? base.sockets[item.id].on),
      watts: clamp(Number(saved.sockets?.[item.id]?.watts ?? base.sockets[item.id].watts), item.min, item.max)
    };
  });

  const merged = {
    lights,
    sockets,
    estores: clamp(Number(saved.estores ?? base.estores), 0, 100),
    temperature: clamp(Number(saved.temperature ?? base.temperature), 16, 30),
    settings: {
      priceKwh: clamp(Number(saved.settings?.priceKwh ?? base.settings.priceKwh), 0.01, 2.5)
    },
    energy: {
      dayKey: typeof saved.energy?.dayKey === "string" ? saved.energy.dayKey : base.energy.dayKey,
      kwhToday: Number.isFinite(saved.energy?.kwhToday) ? saved.energy.kwhToday : base.energy.kwhToday,
      lastSampleMs: Number.isFinite(saved.energy?.lastSampleMs) ? saved.energy.lastSampleMs : base.energy.lastSampleMs,
      hourlyKwh: Array.isArray(saved.energy?.hourlyKwh) && saved.energy.hourlyKwh.length === 24
        ? saved.energy.hourlyKwh.map((v) => (Number.isFinite(v) ? v : 0))
        : base.energy.hourlyKwh
    }
  };

  if (merged.energy.dayKey !== todayKey()) {
    merged.energy.dayKey = todayKey();
    merged.energy.kwhToday = 0;
    merged.energy.hourlyKwh = Array.from({ length: 24 }, () => 0);
    merged.energy.lastSampleMs = Date.now();
  }

  return merged;
}

function saveState() {
  localStorage.setItem(CONTROL_STATE_KEY, JSON.stringify(state));
}

function loadCustomScenes() {
  return parseJSON(localStorage.getItem(CONTROL_CUSTOM_SCENES_KEY), []);
}

function saveCustomScenes(scenes) {
  localStorage.setItem(CONTROL_CUSTOM_SCENES_KEY, JSON.stringify(scenes));
}

let state = loadState();
let customScenes = loadCustomScenes();

function getAllScenes() {
  return [...DEFAULT_SCENES, ...customScenes];
}

function ensureDailyRoll() {
  if (state.energy.dayKey === todayKey()) return;
  state.energy.dayKey = todayKey();
  state.energy.kwhToday = 0;
  state.energy.hourlyKwh = Array.from({ length: 24 }, () => 0);
  state.energy.lastSampleMs = Date.now();
}

function calculateLightWatts() {
  return LIGHT_IDS.reduce((sum, room) => {
    const light = state.lights[room];
    if (!light.on) return sum;
    return sum + Math.round(4 + light.brightness * 0.12);
  }, 0);
}

function calculateSocketWatts() {
  return SOCKET_IDS.reduce((sum, id) => {
    const socket = state.sockets[id];
    return socket.on ? sum + socket.watts : sum;
  }, 0);
}

function calculateClimateWatts() {
  const delta = Math.abs(state.temperature - 22);
  return 110 + delta * 28;
}

function calculateCurrentPower() {
  return calculateLightWatts() + calculateSocketWatts() + calculateClimateWatts();
}

function sampleEnergy() {
  ensureDailyRoll();

  const now = Date.now();
  const elapsedMs = Math.max(0, now - state.energy.lastSampleMs);
  const currentPower = calculateCurrentPower();
  const deltaKwh = (currentPower * elapsedMs) / 3600000000;

  state.energy.kwhToday += deltaKwh;
  const hour = new Date().getHours();
  state.energy.hourlyKwh[hour] += deltaKwh;
  state.energy.lastSampleMs = now;
  saveState();
}

function requireAuth() {
  const page = document.body.dataset.page || "";
  const user = getUser();

  if (page === "login") {
    if (user) {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "index.html";
      window.location.href = next;
      return false;
    }
    return true;
  }

  if (!user) {
    const file = getCurrentFile();
    window.location.href = `login.html?next=${encodeURIComponent(file)}`;
    return false;
  }

  return true;
}

function setupLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("login-name")?.value.trim() || "";
    const email = document.getElementById("login-email")?.value.trim() || "";

    if (!name || !email) return;

    setUser({ name, email });
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "index.html";
    window.location.href = next;
  });
}

function setupHeader() {
  const user = getUser();
  const userName = document.getElementById("user-name");
  if (userName && user) userName.textContent = user.name;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearUser();
      window.location.href = "login.html";
    });
  }

  const file = getCurrentFile();
  document.querySelectorAll(".main-nav a").forEach((link) => {
    if (link.getAttribute("href") === file) link.classList.add("active");
  });
}

function renderLights() {
  LIGHT_IDS.forEach((room) => {
    const toggle = document.querySelector(`[data-toggle="${room}"]`);
    const range = document.querySelector(`[data-range="${room}"]`);
    const value = document.querySelector(`[data-value="${room}"]`);
    const card = toggle?.closest(".card");

    if (toggle) toggle.checked = state.lights[room].on;
    if (range) range.value = String(state.lights[room].brightness);
    if (value) value.textContent = `${state.lights[room].brightness}%`;
    if (card) card.classList.toggle("is-on", state.lights[room].on);
  });

  const lightPower = document.getElementById("lights-power");
  if (lightPower) lightPower.textContent = `${calculateLightWatts()} W`;

  const activeLightsCount = document.getElementById("active-count-lights");
  if (activeLightsCount) {
    const activeLights = LIGHT_IDS.filter((room) => state.lights[room].on).length;
    activeLightsCount.textContent = String(activeLights);
  }
}

function renderSockets() {
  SOCKET_IDS.forEach((id) => {
    const toggle = document.querySelector(`[data-socket-toggle="${id}"]`);
    const range = document.querySelector(`[data-socket-watts="${id}"]`);
    const value = document.querySelector(`[data-socket-value="${id}"]`);
    const card = toggle?.closest(".card");

    if (toggle) toggle.checked = state.sockets[id].on;
    if (range) range.value = String(state.sockets[id].watts);
    if (value) value.textContent = `${state.sockets[id].watts} W`;
    if (card) card.classList.toggle("is-on", state.sockets[id].on);
  });

  const socketsPower = document.getElementById("sockets-power");
  if (socketsPower) socketsPower.textContent = `${calculateSocketWatts()} W`;

  const socketsActive = document.getElementById("sockets-active");
  if (socketsActive) {
    const active = SOCKET_IDS.filter((id) => state.sockets[id].on).length;
    socketsActive.textContent = String(active);
  }
}

function renderAmbiente() {
  const estoresRange = document.querySelector('[data-range="estores"]');
  const estoresValue = document.querySelectorAll('[data-value="estores"]');
  if (estoresRange) estoresRange.value = String(state.estores);
  estoresValue.forEach((node) => {
    node.textContent = `${state.estores}%`;
  });

  const tempValue = document.getElementById("temp-value");
  if (tempValue) tempValue.textContent = String(state.temperature);
}

function renderTopSummary() {
  const activeLights = LIGHT_IDS.filter((room) => state.lights[room].on).length;
  const activeSockets = SOCKET_IDS.filter((id) => state.sockets[id].on).length;
  const totalActive = activeLights + activeSockets;
  const currentPower = calculateCurrentPower();

  const activeCount = document.getElementById("active-count");
  const totalPower = document.getElementById("total-power");
  const status = document.getElementById("system-status");

  if (activeCount) activeCount.textContent = `${totalActive} dispositivos ativos`;
  if (totalPower) totalPower.textContent = `${currentPower} W`;

  if (status) {
    const isEco = currentPower < 350 && state.temperature <= 21 && state.estores <= 25;
    status.textContent = isEco ? "Modo eco ativo" : "Tudo operacional";
  }
}

function renderEnergyMetrics() {
  const power = calculateCurrentPower();
  const dayKwh = state.energy.kwhToday;
  const dayCost = dayKwh * state.settings.priceKwh;
  const monthCost = dayCost * 30;

  const metricPower = document.getElementById("metric-power");
  if (metricPower) metricPower.textContent = `${power} W`;

  const metricKwhDay = document.getElementById("metric-kwh-day");
  if (metricKwhDay) metricKwhDay.textContent = `${dayKwh.toFixed(2)} kWh`;

  const metricEurDay = document.getElementById("metric-eur-day");
  if (metricEurDay) metricEurDay.textContent = eur(dayCost);

  const metricEurMonth = document.getElementById("metric-eur-month");
  if (metricEurMonth) metricEurMonth.textContent = eur(monthCost);
}

function renderConsumoAnalysis() {
  const peakList = document.getElementById("peak-hours");
  const tips = document.getElementById("saving-tips");

  if (peakList) {
    const sorted = state.energy.hourlyKwh
      .map((kwh, hour) => ({ hour, kwh }))
      .sort((a, b) => b.kwh - a.kwh)
      .slice(0, 5);

    peakList.innerHTML = "";

    sorted.forEach((entry, index) => {
      const li = document.createElement("li");
      const from = String(entry.hour).padStart(2, "0");
      const to = String((entry.hour + 1) % 24).padStart(2, "0");
      li.textContent = `${index + 1}. ${from}:00-${to}:00 -> ${entry.kwh.toFixed(3)} kWh`;
      peakList.appendChild(li);
    });

    if (!sorted.length || sorted[0].kwh === 0) {
      const li = document.createElement("li");
      li.textContent = "Sem historico suficiente. Usa o sistema por alguns minutos para gerar dados.";
      peakList.appendChild(li);
    }
  }

  if (tips) {
    tips.innerHTML = "";
    const price = state.settings.priceKwh;

    const standbyWatts = SOCKET_IDS.reduce((acc, id) => {
      const socket = state.sockets[id];
      if (!socket.on) return acc;
      return acc + Math.round(socket.watts * 0.1);
    }, 0);

    const standbySavingMonth = ((standbyWatts * 9 * 30) / 1000) * price;
    const tempDelta = Math.max(0, state.temperature - 22);
    const climateSavingMonth = tempDelta * 5.4;
    const avgBrightness = LIGHT_IDS.reduce((a, room) => a + state.lights[room].brightness, 0) / LIGHT_IDS.length;
    const lightSavingMonth = avgBrightness > 60 ? 5.2 : 2.4;

    const entries = [
      `Desligar standby das tomadas em horarios vazios pode reduzir cerca de ${eur(standbySavingMonth)} por mes.`,
      `Baixar 1-2 C na climatizacao pode poupar aproximadamente ${eur(climateSavingMonth)} por mes.`,
      `Reducao de brilho medio para 45-55% pode cortar cerca de ${eur(lightSavingMonth)} por mes em iluminacao.`
    ];

    entries.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      tips.appendChild(li);
    });
  }
}

function renderSceneQuickButtons() {
  const wrap = document.getElementById("scene-quick-list");
  if (!wrap) return;

  wrap.innerHTML = "";
  getAllScenes().forEach((scene) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-btn reveal visible";
    button.dataset.applyScene = scene.id;
    button.textContent = scene.name;
    wrap.appendChild(button);
  });
}

function renderSceneLibrary() {
  const wrap = document.getElementById("scene-library");
  if (!wrap) return;

  wrap.innerHTML = "";

  getAllScenes().forEach((scene) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h4>${scene.name}</h4>
      <p class="small">${scene.builtin ? "Cena predefinida" : "Cena personalizada"}</p>
      <div class="row-inline" style="margin-top:10px;">
        <button class="btn primary" type="button" data-apply-scene="${scene.id}">Aplicar</button>
        ${scene.builtin ? "" : `<button class="btn danger" type="button" data-delete-scene="${scene.id}">Remover</button>`}
      </div>
    `;
    wrap.appendChild(card);
  });

  const count = document.getElementById("scene-count");
  if (count) count.textContent = String(getAllScenes().length);
}

function applySceneConfig(config) {
  LIGHT_IDS.forEach((room) => {
    if (!(room in (config.lights || {}))) return;
    const value = clamp(Number(config.lights[room]), 0, 100);
    state.lights[room].brightness = value;
    state.lights[room].on = value > 0;
  });

  SOCKET_IDS.forEach((id) => {
    if (!(id in (config.socketsOn || {}))) return;
    state.sockets[id].on = Boolean(config.socketsOn[id]);
  });

  state.estores = clamp(Number(config.estores ?? state.estores), 0, 100);
  state.temperature = clamp(Number(config.temperature ?? state.temperature), 16, 30);
}

function applySceneById(sceneId) {
  const scene = getAllScenes().find((item) => item.id === sceneId);
  if (!scene) return;
  sampleEnergy();
  applySceneConfig(scene.config);
  saveState();
  renderAll();
}

function setupScenesHandlers() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const applyButton = target.closest("[data-apply-scene]");
    if (applyButton instanceof HTMLElement) {
      const sceneId = applyButton.dataset.applyScene;
      if (sceneId) applySceneById(sceneId);
      return;
    }

    const deleteButton = target.closest("[data-delete-scene]");
    if (deleteButton instanceof HTMLElement) {
      const sceneId = deleteButton.dataset.deleteScene;
      if (!sceneId) return;
      customScenes = customScenes.filter((scene) => scene.id !== sceneId);
      saveCustomScenes(customScenes);
      renderSceneLibrary();
      renderSceneQuickButtons();
    }
  });
}

function setupSceneForm() {
  const form = document.getElementById("scene-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = (document.getElementById("scene-name")?.value || "").trim();
    if (!name) return;

    const customScene = {
      id: `custom-${Date.now()}`,
      name,
      builtin: false,
      config: {
        lights: {
          sala: clamp(Number(document.getElementById("scene-sala")?.value || 0), 0, 100),
          cozinha: clamp(Number(document.getElementById("scene-cozinha")?.value || 0), 0, 100),
          quarto: clamp(Number(document.getElementById("scene-quarto")?.value || 0), 0, 100)
        },
        socketsOn: {
          tv: Boolean(document.getElementById("scene-tv")?.checked),
          maquina: Boolean(document.getElementById("scene-maquina")?.checked),
          escritorio: Boolean(document.getElementById("scene-escritorio")?.checked)
        },
        estores: clamp(Number(document.getElementById("scene-estores")?.value || 0), 0, 100),
        temperature: clamp(Number(document.getElementById("scene-temp")?.value || 22), 16, 30)
      }
    };

    customScenes.push(customScene);
    saveCustomScenes(customScenes);
    form.reset();
    renderSceneLibrary();
    renderSceneQuickButtons();
  });
}

function setupControls() {
  LIGHT_IDS.forEach((room) => {
    const toggle = document.querySelector(`[data-toggle="${room}"]`);
    const range = document.querySelector(`[data-range="${room}"]`);

    if (toggle) {
      toggle.addEventListener("change", () => {
        sampleEnergy();
        state.lights[room].on = toggle.checked;
        saveState();
        renderAll();
      });
    }

    if (range) {
      range.addEventListener("input", () => {
        sampleEnergy();
        state.lights[room].brightness = clamp(Number(range.value), 0, 100);
        state.lights[room].on = state.lights[room].brightness > 0;
        saveState();
        renderAll();
      });
    }
  });

  SOCKETS_META.forEach((item) => {
    const toggle = document.querySelector(`[data-socket-toggle="${item.id}"]`);
    const range = document.querySelector(`[data-socket-watts="${item.id}"]`);

    if (toggle) {
      toggle.addEventListener("change", () => {
        sampleEnergy();
        state.sockets[item.id].on = toggle.checked;
        saveState();
        renderAll();
      });
    }

    if (range) {
      range.addEventListener("input", () => {
        sampleEnergy();
        state.sockets[item.id].watts = clamp(Number(range.value), item.min, item.max);
        saveState();
        renderAll();
      });
    }
  });

  const estoresRange = document.querySelector('[data-range="estores"]');
  if (estoresRange) {
    estoresRange.addEventListener("input", () => {
      sampleEnergy();
      state.estores = clamp(Number(estoresRange.value), 0, 100);
      saveState();
      renderAll();
    });
  }

  document.querySelectorAll("[data-temp]").forEach((button) => {
    button.addEventListener("click", () => {
      sampleEnergy();
      const up = button.getAttribute("data-temp") === "up";
      state.temperature = clamp(state.temperature + (up ? 1 : -1), 16, 30);
      saveState();
      renderAll();
    });
  });

  const closeAll = document.getElementById("close-all");
  if (closeAll) {
    closeAll.addEventListener("click", () => {
      sampleEnergy();
      state.estores = 0;
      saveState();
      renderAll();
    });
  }

  const priceInput = document.getElementById("price-kwh");
  if (priceInput) {
    priceInput.value = state.settings.priceKwh.toFixed(2);
    priceInput.addEventListener("input", () => {
      state.settings.priceKwh = clamp(Number(priceInput.value) || 0.23, 0.01, 2.5);
      saveState();
      renderEnergyMetrics();
      renderConsumoAnalysis();
    });
  }
}

function setupReveal() {
  const revealElements = document.querySelectorAll(".reveal");
  if (!revealElements.length) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14 });

    revealElements.forEach((el) => observer.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add("visible"));
  }
}

function renderAll() {
  renderLights();
  renderSockets();
  renderAmbiente();
  renderTopSummary();
  renderEnergyMetrics();
  renderConsumoAnalysis();
  renderSceneQuickButtons();
  renderSceneLibrary();
}

function startEnergyLoop() {
  setInterval(() => {
    sampleEnergy();
    renderEnergyMetrics();
    renderTopSummary();
    renderConsumoAnalysis();
  }, 5000);
}

function init() {
  const page = document.body.dataset.page || "";

  if (!requireAuth()) return;

  if (page === "login") {
    setupReveal();
    setupLoginPage();
    return;
  }

  setupHeader();
  setupControls();
  setupScenesHandlers();
  setupSceneForm();
  setupReveal();
  renderAll();
  startEnergyLoop();
}

init();
