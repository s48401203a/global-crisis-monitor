/** 地图形态：平面 ⇄ 地球仪过渡、星空背景、卫星/地形地表、进行中事件呼吸闪烁。 */
import { LOCAL_CENTER } from "../constants.js";
import { L } from "../i18n/index.js";
import { setCosmosVisible } from "./cosmos.js";
import { prefersReducedMotion } from "../util/timing.js";
import { map } from "./instance.js";
import { showToast } from "../panels/index.js";
import { state } from "../state.js";

let mapModeAnimating = false;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const easeInOutQuart = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

function easePromise(opts) {
  return new Promise((resolve) => {
    if (!state.mapReady) {
      resolve();
      return;
    }
    try {
      map.stop();
    } catch (_) {}
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        map.off("moveend", finish);
      } catch (_) {}
      resolve();
    };
    try {
      map.once("moveend", finish);
      map.easeTo({ essential: true, ...opts });
    } catch (err) {
      console.warn("easePromise", err);
      finish();
      return;
    }
    setTimeout(finish, (opts.duration || 1000) + 500);
  });
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function lerpLng(a, b, t) {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return a + d * t;
}

function readCamera() {
  const c = map.getCenter();
  return {
    lng: c.lng,
    lat: c.lat,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function writeCamera(cam) {
  try {
    map.jumpTo({
      center: [cam.lng, cam.lat],
      zoom: cam.zoom,
      bearing: cam.bearing,
      pitch: cam.pitch,
    });
  } catch (_) {}
}

function mixCamera(a, b, t) {
  return {
    lng: lerpLng(a.lng, b.lng, t),
    lat: mix(a.lat, b.lat, t),
    zoom: mix(a.zoom, b.zoom, t),
    bearing: mix(a.bearing, b.bearing, t),
    pitch: mix(a.pitch, b.pitch, t),
  };
}

/** 全程 inset，避免 inset↔circle 在中点跳变 */
function morphClip(p) {
  const m = mix(0, 17, p);
  const r = mix(0, 50, p);
  return `inset(${m.toFixed(2)}% round ${r.toFixed(2)}%)`;
}

function applyStageMorph(p, veilOpacity) {
  const stage = getMapStage();
  const veil = getMapVeil();
  if (stage) {
    const clip = morphClip(p);
    const scale = mix(1, 0.9, p);
    stage.style.clipPath = clip;
    stage.style.webkitClipPath = clip;
    stage.style.transform = `scale(${scale.toFixed(4)})`;
    stage.style.filter = `brightness(${mix(1, 0.93, p).toFixed(3)})`;
  }
  if (veil) veil.style.opacity = String(veilOpacity);
}

function runFrameLoop(duration, onFrame) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      try {
        onFrame(t);
      } catch (_) {}
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function waitMapRenders(n = 2, timeoutMs = 160) {
  return new Promise((resolve) => {
    let left = n;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        map.off("render", onRender);
      } catch (_) {}
      resolve();
    };
    const onRender = () => {
      left -= 1;
      if (left <= 0) finish();
    };
    try {
      map.on("render", onRender);
      map.triggerRepaint();
    } catch (_) {
      finish();
      return;
    }
    setTimeout(finish, timeoutMs);
  });
}

function captureMapSnap() {
  const src = map.getCanvas();
  const snap = document.createElement("canvas");
  snap.className = "map-swap-snap";
  snap.width = src.width;
  snap.height = src.height;
  try {
    snap.getContext("2d").drawImage(src, 0, 0);
  } catch (_) {}
  let painted = false;
  try {
    const px = snap.getContext("2d").getImageData(snap.width >> 1, snap.height >> 1, 1, 1).data;
    painted = px[3] > 8;
  } catch (_) {}
  if (!painted) return null;
  getMapStage()?.appendChild(snap);
  return snap;
}

function fadeEl(el, from, to, duration) {
  if (!el) return Promise.resolve();
  el.style.opacity = String(from);
  return runFrameLoop(duration, (t) => {
    const k = easeOutCubic(t);
    el.style.opacity = String(mix(from, to, k));
  });
}

function safeSetProjection(type) {
  try {
    map.setProjection({ type });
    return true;
  } catch (err) {
    console.warn("setProjection", type, err);
    return false;
  }
}

function safeClearTerrain() {
  try {
    map.setTerrain(null);
  } catch (_) {
    try {
      map.setTerrain(undefined);
    } catch (_) {}
  }
}

function safeClearFog() {
  try {
    map.setFog(null);
  } catch (_) {
    try {
      // 部分版本不接受 null，用透明雾近似关闭
      map.setFog({
        range: [2, 20],
        color: "rgba(2,6,14,0)",
        "horizon-blend": 0.01,
        "star-intensity": 0,
      });
    } catch (_) {}
  }
}

function setGlobeFog(intensity = 1) {
  const i = Math.max(0, Math.min(1, intensity));
  try {
    map.setFog({
      range: [0.5, 10],
      color: `rgb(${Math.round(10 + 8 * i)}, ${Math.round(16 + 14 * i)}, ${Math.round(36 + 22 * i)})`,
      "high-color": `rgb(${Math.round(70 + 50 * i)}, ${Math.round(120 + 50 * i)}, ${Math.round(180 + 40 * i)})`,
      "space-color": "rgb(6, 8, 22)",
      "horizon-blend": 0.07 + 0.06 * i,
      "star-intensity": 0.45 + 0.55 * i,
    });
  } catch (err) {
    console.warn("setGlobeFog", err);
  }
}

/** 强制进入某形态并清理 CSS/交互残留（失败恢复用） */
function forceMapMode(mode) {
  stageResetMorph();
  safeClearTerrain();
  if (mode === "globe") {
    if (!safeSetProjection("globe")) {
      safeSetProjection("mercator");
      safeClearFog();
      return false;
    }
    setGlobeFog(1);
    setCosmosVisible(true);
    // 地球仪默认不加 terrain：globe+terrain 在部分环境会抛错导致切换失败
  } else {
    safeSetProjection("mercator");
    safeClearFog();
    setCosmosVisible(false);
  }
  try {
    map.resize();
  } catch (_) {}
  return true;
}

function syncMapModeButtons(mode) {
  document.querySelectorAll("[data-mapmode]").forEach((b) => {
    const on = b.dataset.mapmode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
}

/**
 * 平面图 ⇄ 地球仪
 * - 成功后才提交 state.mapMode
 * - 失败必复位 CSS + 投影，绝不留下「倒过来」的卷曲态
 * - 动画失败时降级为瞬间切投影
 */
async function applyMapMode(mode, opts = {}) {
  if (mode !== "flat" && mode !== "globe") return;

  if (!state.mapReady && !opts.force && !opts.silent) {
    state.mapMode = mode;
    syncMapModeButtons(mode);
    return;
  }

  if (opts.silent) {
    const ok = forceMapMode(mode);
    state.mapMode = ok ? mode : "flat";
    syncMapModeButtons(state.mapMode);
    return;
  }

  if (state.mapMode === mode) {
    syncMapModeButtons(mode);
    // 若 CSS 残留导致视觉异常，点同一按钮也可复位
    stageResetMorph();
    return;
  }
  if (mapModeAnimating) return;

  if (prefersReducedMotion()) {
    const ok = forceMapMode(mode);
    state.mapMode = ok ? mode : "flat";
    syncMapModeButtons(state.mapMode);
    showToast(L().mapForm, mode === "globe" ? L().mapGlobeFast : L().mapFlatFast);
    return;
  }

  mapModeAnimating = true;
  const prev = state.mapMode;
  syncMapModeButtons(mode); // 按钮先反馈目标态

  try {
    map.boxZoom.disable();
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disable();
  } catch (_) {}

  try {
    if (mode === "globe") {
      await transitionFlatToGlobe();
    } else {
      await transitionGlobeToFlat();
    }
    state.mapMode = mode;
    stageResetMorph();
    try {
      map.resize();
    } catch (_) {}
    showToast(L().mapForm, mode === "globe" ? L().mapGlobe : L().mapFlat);
  } catch (err) {
    console.warn("applyMapMode animated failed, fallback", err);
    // 动画失败 → 瞬间切投影（无 CSS 卷曲）
    stageResetMorph();
    const ok = forceMapMode(mode);
    if (ok) {
      state.mapMode = mode;
      syncMapModeButtons(mode);
      showToast(L().mapForm, mode === "globe" ? L().mapGlobeFast : L().mapFlatFast);
    } else {
      forceMapMode(prev);
      state.mapMode = prev;
      syncMapModeButtons(prev);
      showToast(L().mapForm, L().mapFail);
    }
  } finally {
    stageResetMorph();
    try {
      map.boxZoom.enable();
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.dragRotate.enable();
      map.touchZoomRotate.enable();
    } catch (_) {}
    mapModeAnimating = false;
  }
}

function getMapStage() {
  return document.getElementById("map-stage");
}

function getMapVeil() {
  return document.getElementById("map-veil");
}

function stageResetMorph() {
  const stage = getMapStage();
  const veil = getMapVeil();
  if (stage) {
    try {
      stage.getAnimations().forEach((a) => a.cancel());
    } catch (_) {}
    stage.querySelectorAll(".map-swap-snap").forEach((n) => n.remove());
    stage.classList.remove("is-morphing", "is-sphere");
    stage.style.transform = "none";
    stage.style.filter = "none";
    stage.style.opacity = "";
    stage.style.clipPath = "none";
    stage.style.webkitClipPath = "none";
    stage.style.animation = "";
  }
  if (veil) {
    try {
      veil.getAnimations().forEach((a) => a.cancel());
    } catch (_) {}
    veil.style.opacity = "";
  }
}

/**
 * 收束 → 快照盖住投影硬切 → 展开。镜头全程 jumpTo 插值，中间不停 easeTo。
 */
async function playMorphTransition({ projection, midCam, endCam, fogTo }) {
  const stage = getMapStage();
  if (stage) stage.classList.add("is-morphing");
  try {
    map.stop();
  } catch (_) {}

  const startCam = readCamera();
  const peak = 0.7;

  await runFrameLoop(1020, (t) => {
    const u = easeInOutCubic(t);
    writeCamera(mixCamera(startCam, midCam, u));
    applyStageMorph(u * peak, mix(0, 0.16, u));
  });

  const snap = captureMapSnap();
  if (projection === "globe") {
    if (!safeSetProjection("globe")) throw new Error("globe projection unsupported");
    setGlobeFog(0.4);
    setCosmosVisible(true);
  } else {
    safeClearTerrain();
    safeClearFog();
    if (!safeSetProjection("mercator")) throw new Error("mercator projection failed");
    setCosmosVisible(false);
  }
  writeCamera(midCam);
  await waitMapRenders(2, 120);
  const fadeSnap = snap ? fadeEl(snap, 1, 0, 420).then(() => snap.remove()) : Promise.resolve();

  let fogTick = 0;
  await runFrameLoop(1380, (t) => {
    const v = easeOutCubic(t);
    writeCamera(mixCamera(midCam, endCam, v));
    applyStageMorph(peak * (1 - v), mix(0.16, 0, v));
    fogTick += 1;
    if (projection === "globe" && fogTick % 3 === 0) setGlobeFog(mix(0.4, fogTo ?? 1, v));
  });

  if (projection === "globe") setGlobeFog(fogTo ?? 1);
  applyStageMorph(0, 0);
  await fadeSnap;
  if (snap?.parentNode) snap.remove();
}

async function transitionFlatToGlobe() {
  const start = readCamera();
  const midLat = Math.max(-14, Math.min(14, start.lat * 0.4));
  const globeLat = Math.max(-6, Math.min(6, midLat * 0.45));
  safeClearTerrain();
  await playMorphTransition({
    projection: "globe",
    midCam: {
      lng: start.lng,
      lat: midLat,
      zoom: Math.min(Math.max(start.zoom, 1.25), 1.55),
      bearing: start.bearing * 0.25,
      pitch: 0,
    },
    endCam: {
      lng: start.lng,
      lat: globeLat,
      zoom: 1.32,
      bearing: start.bearing * 0.12 + 14,
      pitch: 0,
    },
    fogTo: 1,
  });
}

async function transitionGlobeToFlat() {
  const start = readCamera();
  const targetCenter = state.currentView === "local" ? LOCAL_CENTER : [20, 25];
  const targetZoom = state.currentView === "local" ? 3.5 : 1.7;
  await playMorphTransition({
    projection: "mercator",
    midCam: {
      lng: lerpLng(start.lng, targetCenter[0], 0.45),
      lat: mix(start.lat, targetCenter[1], 0.45),
      zoom: Math.min(Math.max(start.zoom, 1.28), 1.6),
      bearing: start.bearing * 0.2,
      pitch: 0,
    },
    endCam: {
      lng: targetCenter[0],
      lat: targetCenter[1],
      zoom: targetZoom,
      bearing: 0,
      pitch: 0,
    },
  });
}

/** 卫星影像 / 地形地貌 地表切换 */
function applySurfaceMode(mode, opts = {}) {
  state.surfaceMode = mode;
  document.querySelectorAll("[data-surface]").forEach((b) => {
    const on = b.dataset.surface === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (!state.mapReady) return;
  const showSat = mode === "sat";
  if (map.getLayer("surface-sat")) {
    map.setLayoutProperty("surface-sat", "visibility", showSat ? "visible" : "none");
  }
  if (map.getLayer("surface-topo")) {
    map.setLayoutProperty("surface-topo", "visibility", showSat ? "none" : "visible");
  }
  if (map.getLayer("surface-labels")) {
    map.setLayoutProperty("surface-labels", "visibility", showSat ? "visible" : "none");
  }
  // 地形图时国界线加深，便于读行政区
  if (map.getLayer("country-line")) {
    map.setPaintProperty(
      "country-line",
      "line-color",
      showSat ? "rgba(230, 240, 255, 0.55)" : "rgba(30, 40, 50, 0.7)",
    );
  }
  if (map.getLayer("country-fill")) {
    map.setPaintProperty("country-fill", "fill-opacity", showSat ? 0.08 : 0.03);
  }
  if (!opts.silent) {
    showToast(L().surface, showSat ? L().surfaceSat : L().surfaceTopo);
  }
}

/** 进行中事件外圈/光晕呼吸闪烁（仅 transform 类 paint，GPU 友好） */
function startLivePulse() {
  if (window._livePulseStarted) return;
  window._livePulseStarted = true;
  const tick = (ts) => {
    if (state.mapReady && map.getLayer("ev-live-ring")) {
      // 1.25s 周期，0→1→0
      const s = 0.5 + 0.5 * Math.sin(((ts / 1000) * Math.PI * 2) / 1.25);
      try {
        map.setPaintProperty("ev-live-glow", "circle-radius", [
          "interpolate",
          ["linear"],
          ["get", "severity"],
          0,
          12 + s * 10,
          0.5,
          20 + s * 14,
          1,
          30 + s * 18,
        ]);
        map.setPaintProperty("ev-live-glow", "circle-opacity", 0.08 + s * 0.28);
        map.setPaintProperty("ev-live-ring", "circle-radius", [
          "interpolate",
          ["linear"],
          ["get", "severity"],
          0,
          7 + s * 5,
          0.5,
          12 + s * 7,
          1,
          18 + s * 10,
        ]);
        map.setPaintProperty("ev-live-ring", "circle-stroke-opacity", 0.35 + s * 0.6);
        map.setPaintProperty("ev-live-ring", "circle-stroke-width", 1.4 + s * 1.6);
        map.setPaintProperty("ev-live-core", "circle-opacity", 0.55 + s * 0.45);
        map.setPaintProperty("ev-live-core", "circle-radius", [
          "interpolate",
          ["linear"],
          ["get", "severity"],
          0,
          4 + s * 1.2,
          0.5,
          8 + s * 2,
          1,
          14 + s * 3,
        ]);
      } catch (_) {
        /* 图层未就绪时忽略 */
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export {
  mapModeAnimating,
  easeInOutCubic,
  easeOutQuint,
  easeOutCubic,
  easeInOutQuart,
  easePromise,
  mix,
  lerpLng,
  readCamera,
  writeCamera,
  mixCamera,
  morphClip,
  applyStageMorph,
  runFrameLoop,
  waitMapRenders,
  captureMapSnap,
  fadeEl,
  safeSetProjection,
  safeClearTerrain,
  safeClearFog,
  setGlobeFog,
  setCosmosVisible,
  forceMapMode,
  syncMapModeButtons,
  applyMapMode,
  getMapStage,
  getMapVeil,
  stageResetMorph,
  playMorphTransition,
  transitionFlatToGlobe,
  transitionGlobeToFlat,
  applySurfaceMode,
  startLivePulse,
};
