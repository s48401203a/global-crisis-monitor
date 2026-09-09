import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import maplibregl from "maplibre-gl";
import {
  connectWS,
  loadHealth,
  loadTheaters,
  refresh,
  setLivePill,
  syncTheaterLayer,
} from "./api/client.js";
import { breakingDwellMs, enqueueBreakingAlerts, pumpBreakingQueue } from "./breaking.js";
import {
  TYPE_COLORS,
  TYPE_COLOR_DEFAULT,
  blinkStartedAt,
  breakingBlinkUntil,
} from "./constants.js";
import { initDockablePanels, refreshDockTitles } from "./dock-panels.js";
import { countryLabel, loadIso3Zh } from "./grade.js";
import { L, UI_I18N, getLang, setLang } from "./i18n/index.js";
import { SURFACE_TILES, map } from "./map/instance.js";
import {
  addBilingualPlaceLabels,
  applyPlaceLabelLang,
  ensureGazetteerCityLabels,
} from "./map/labels.js";
import { applyMapMode, applySurfaceMode, startLivePulse } from "./map/projection.js";
import {
  renderTypeLegend,
  setAllTypeFilters,
  setInvertTypeFilters,
  setPanelsCollapsed,
  showToast,
  syncSearchChrome,
  updatePanelsToggleButton,
} from "./panels/index.js";
import { applyFeatures, bindTimeRangeButtons, setSearchQuery, setView } from "./pipeline.js";
import { closeTourPopup, showEventPopup, theaterPopupHtml } from "./popup/index.js";
import { state } from "./state.js";
import {
  exitTourMode,
  onMapBackgroundClick,
  setTourRegionFocus,
  tourJumpToId,
  tourNextEvent,
} from "./tour/index.js";
import { initCosmos } from "./map/cosmos.js";

/* ========== 界面语言：中文 / English（联动地图地名） ========== */

/* 空格键巡览：逐个飞入灾害点 → 弹窗 → 再按空格切下一项 */

/* 地图形态：平面 / 地球仪；地表材质：卫星 / 地形 */

/**
 * 类型配色（地图点 / 列表 / 图例统一）
 * 地震默认中性琥珀；≥5 黄、≥7 红由 mapMarkerColor 覆盖
 */

/* ========== 简报 / 影响范围 / 路径几何 ========== */

/* ISO3 → 中文国家名（启动时从 /data/iso3-zh.json 合并完整表） */

/* ========== 英文标题 → 中文展示（数据源原文多为英文） ========== */

function tickClock() {
  const el = document.getElementById("clock");
  const now = new Date();
  el.textContent =
    now.toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + " 北京时间";
}
setInterval(tickClock, 1000);
tickClock();

/* ========== 地图（卫星/地形地表 + 平面/地球仪） ========== */

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), "bottom-right");

/** 应用界面语言：静态 DOM + 地图地名 + 动态列表重绘 */
function applyUiLang(lang, opts = {}) {
  if (lang !== "zh" && lang !== "en") return;
  setLang(lang);

  document.documentElement.lang = getLang() === "en" ? "en" : "zh-CN";
  document.title = UI_I18N[getLang()].title;

  // data-i18n 文本节点
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = UI_I18N[getLang()][key];
    if (val != null) el.textContent = val;
  });
  // data-i18n-title
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const val = UI_I18N[getLang()][key];
    if (val != null) el.title = val;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const val = UI_I18N[getLang()][key];
    if (val != null) el.placeholder = val;
  });
  syncSearchChrome();
  updatePanelsToggleButton();
  refreshDockTitles();

  // 语言按钮态
  document.querySelectorAll("[data-lang]").forEach((b) => {
    const on = b.dataset.lang === getLang();
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });

  // 地图地名
  applyPlaceLabelLang();

  // 动态面板
  const hint = document.getElementById("viewHint");
  if (hint) {
    hint.textContent = state.currentView === "local" ? L().viewLocal : L().viewGlobal;
  }
  // 状态 pill 文案随语言更新（保持横向 DOM）
  const livePill = document.getElementById("livePill");
  if (livePill) {
    const ok = !livePill.classList.contains("is-err");
    setLivePill(ok);
  }
  renderTypeLegend();
  if (state.lastFeatures.length) applyFeatures(state.lastFeatures);
  if (opts.toast) {
    showToast(getLang() === "en" ? "Language" : "语言", L().langSwitched);
  }
}

map.on("load", async () => {
  await loadIso3Zh();
  // —— 地表材质（卫星 / 地形）更高精度 ——
  map.addSource("surface-sat", {
    type: "raster",
    tiles: SURFACE_TILES.sat.tiles,
    tileSize: 256,
    maxzoom: SURFACE_TILES.sat.maxzoom,
    attribution: SURFACE_TILES.sat.attribution,
  });
  map.addSource("surface-labels", {
    type: "raster",
    tiles: SURFACE_TILES.labels.tiles,
    tileSize: 256,
    maxzoom: SURFACE_TILES.labels.maxzoom,
    attribution: SURFACE_TILES.labels.attribution,
  });
  map.addSource("surface-topo", {
    type: "raster",
    tiles: SURFACE_TILES.topo.tiles,
    tileSize: 256,
    maxzoom: SURFACE_TILES.topo.maxzoom,
    attribution: SURFACE_TILES.topo.attribution,
  });
  map.addLayer({
    id: "surface-sat",
    type: "raster",
    source: "surface-sat",
    paint: {
      "raster-opacity": 1,
      "raster-fade-duration": 120,
      "raster-resampling": "linear",
    },
  });
  map.addLayer({
    id: "surface-topo",
    type: "raster",
    source: "surface-topo",
    layout: { visibility: "none" },
    paint: {
      "raster-opacity": 1,
      "raster-fade-duration": 120,
      "raster-resampling": "linear",
    },
  });
  // Esri 英文栅格注记：压到极低透明度，避免与中英双语矢量注记叠字
  map.addLayer({
    id: "surface-labels",
    type: "raster",
    source: "surface-labels",
    paint: {
      "raster-opacity": 0.12,
      "raster-fade-duration": 120,
    },
  });

  // 国界：Natural Earth 50m（比 110m 精细一档）
  map.addSource("countries", { type: "geojson", data: "/data/countries.geojson" });
  map.addLayer({
    id: "country-fill",
    type: "fill",
    source: "countries",
    paint: {
      "fill-color": "#0a1420",
      "fill-opacity": 0.08,
    },
  });
  map.addLayer({
    id: "country-line",
    type: "line",
    source: "countries",
    paint: {
      "line-color": "rgba(230, 240, 255, 0.55)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 4, 0.9, 8, 1.4, 12, 2.0],
      "line-opacity": 0.9,
    },
  });
  // 中国高亮（本地模式用）
  map.addLayer({
    id: "china-highlight",
    type: "line",
    source: "countries",
    filter: ["==", ["get", "iso3"], "CHN"],
    paint: {
      "line-color": "#4ec9d4",
      "line-width": 0,
      "line-opacity": 0,
    },
  });

  // —— 中英双语地名（中文在上、英文小字在下；平面/地球仪通用）——
  await addBilingualPlaceLabels();

  // 地形高程（地球仪立体感；失败则忽略）
  try {
    map.addSource("terrain-dem", {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 15,
    });
  } catch (_) {
    /* ignore */
  }

  map.addSource("events", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  // 特效层：地震影响圈、台风路径、洪水方向
  map.addSource("effects", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // 地震影响圈（全局可见）
  map.addLayer({
    id: "fx-eq-fill",
    type: "fill",
    source: "effects",
    filter: ["==", ["get", "effect"], "eq_ring"],
    paint: {
      "fill-color": ["coalesce", ["get", "marker_color"], "#f0b429"],
      "fill-opacity": ["case", ["==", ["get", "ring"], "inner"], 0.14, 0.07],
    },
  });
  map.addLayer({
    id: "fx-eq-line",
    type: "line",
    source: "effects",
    filter: ["==", ["get", "effect"], "eq_ring"],
    paint: {
      "line-color": ["coalesce", ["get", "marker_color"], "#f0b429"],
      "line-width": ["case", ["==", ["get", "ring"], "inner"], 1.6, 1.1],
      "line-opacity": 0.75,
      "line-dasharray": [1.2, 1.2],
    },
  });
  // 台风路径（全局可见）
  map.addLayer({
    id: "fx-track",
    type: "line",
    source: "effects",
    filter: ["==", ["get", "effect"], "track"],
    paint: {
      "line-color": ["coalesce", ["get", "marker_color"], "#5b8def"],
      "line-width": 2.6,
      "line-opacity": 0.9,
      "line-dasharray": [2, 1],
    },
  });
  // 洪水方向：仅高 zoom 或聚焦；细、淡，避免县市预警挤成一团
  map.addLayer({
    id: "fx-flood-dir",
    type: "line",
    source: "effects",
    filter: [
      "all",
      ["==", ["get", "effect"], "flood_dir"],
      ["any", [">=", ["zoom"], 7.2], ["==", ["get", "focused"], 1]],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": ["coalesce", ["get", "marker_color"], "#38bdf8"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.05, 10, 1.55, 13, 2.0],
      "line-opacity": ["case", ["==", ["get", "focused"], 1], 0.7, 0.34],
      "line-blur": 0.4,
    },
  });

  // 战区基线层：独立 source，画在事件点下方；菱形描边区分"非事件"
  map.addSource("theaters", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "theater-halo",
    type: "circle",
    source: "theaters",
    paint: {
      "circle-radius": ["match", ["get", "level"], "high", 26, "medium", 20, 15],
      "circle-color": TYPE_COLORS.theater,
      "circle-opacity": 0.12,
      "circle-blur": 0.8,
    },
  });
  map.addLayer({
    id: "theater-ring",
    type: "circle",
    source: "theaters",
    paint: {
      "circle-radius": ["match", ["get", "level"], "high", 11, "medium", 9, 7],
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-width": 2,
      "circle-stroke-color": TYPE_COLORS.theater,
      "circle-stroke-opacity": 0.85,
    },
  });
  map.addLayer({
    id: "theater-core",
    type: "circle",
    source: "theaters",
    paint: {
      "circle-radius": 3,
      "circle-color": TYPE_COLORS.theater,
      "circle-opacity": 0.9,
    },
  });

  // 标记色来自要素属性 marker_color（与列表等级色一致，含地震≥5黄/≥7红）
  const colorByMarker = ["coalesce", ["get", "marker_color"], TYPE_COLOR_DEFAULT];

  // 历史/常规点：柔光底
  map.addLayer({
    id: "ev-glow",
    type: "circle",
    source: "events",
    filter: ["all", ["==", ["geometry-type"], "Point"], ["!=", ["get", "is_live"], 1]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 0, 8, 0.5, 16, 1, 28],
      "circle-color": colorByMarker,
      "circle-opacity": 0.16,
      "circle-blur": 0.75,
    },
  });
  map.addLayer({
    id: "ev-track",
    type: "line",
    source: "events",
    filter: ["==", ["geometry-type"], "LineString"],
    paint: {
      "line-color": ["coalesce", ["get", "track_color"], ["get", "marker_color"], "#e0a34a"],
      "line-width": 2,
      "line-dasharray": [2, 1],
      "line-opacity": 0.85,
    },
  });
  // 常规实体点（非进行中）
  map.addLayer({
    id: "ev-point",
    type: "circle",
    source: "events",
    filter: ["all", ["==", ["geometry-type"], "Point"], ["!=", ["get", "is_live"], 1]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 0, 3.5, 0.5, 8, 1, 15],
      "circle-color": colorByMarker,
      "circle-opacity": ["*", 0.9, ["coalesce", ["get", "confidence"], 1]],
      "circle-stroke-width": 1.2,
      "circle-stroke-color": "#06090f",
    },
  });

  // —— 进行中事件：外圈光晕 + 中环 + 内核（由 startLivePulse 驱动闪烁）——
  map.addLayer({
    id: "ev-live-glow",
    type: "circle",
    source: "events",
    filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "is_live"], 1]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 0, 14, 0.5, 22, 1, 34],
      "circle-color": colorByMarker,
      "circle-opacity": 0.18,
      "circle-blur": 0.9,
    },
  });
  map.addLayer({
    id: "ev-live-ring",
    type: "circle",
    source: "events",
    filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "is_live"], 1]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 0, 8, 0.5, 14, 1, 22],
      "circle-color": "rgba(0,0,0,0)",
      "circle-opacity": 1,
      "circle-stroke-width": 2.2,
      "circle-stroke-color": colorByMarker,
      "circle-stroke-opacity": 0.75,
    },
  });
  map.addLayer({
    id: "ev-live-core",
    type: "circle",
    source: "events",
    filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "is_live"], 1]],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "severity"], 0, 4.5, 0.5, 9, 1, 16],
      "circle-color": colorByMarker,
      "circle-opacity": 0.95,
      "circle-stroke-width": 1.4,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-opacity": 0.55,
    },
  });

  const openPopup = (e) => {
    const f = e.features[0];
    const p = f.properties;
    const coords =
      f.geometry && f.geometry.coordinates ? f.geometry.coordinates : [e.lngLat.lng, e.lngLat.lat];
    const country = p.country || null;
    setTourRegionFocus(
      {
        country,
        lon: coords[0],
        lat: coords[1],
        name: country ? countryLabel(country) : "就近海域",
        radiusKm: country ? null : 1200,
      },
      { anchorId: p.id, silent: false },
    );
    showEventPopup(p, coords);
  };
  // 同一点可能同时命中 ev-point / live-core / live-ring，只处理一次
  map.on("click", (e) => {
    // 战区核心点很小（3px），命中它说明用户明确点的是战区标记；否则事件点优先
    const coreLayer = map.getLayer("theater-core") ? ["theater-core"] : [];
    const coreHit = coreLayer.length
      ? map.queryRenderedFeatures(e.point, { layers: coreLayer })
      : [];
    const layers = ["ev-live-core", "ev-point", "ev-live-ring"].filter((id) => map.getLayer(id));
    const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
    if (hit.length && !coreHit.length) {
      openPopup({ features: [hit[0]], lngLat: e.lngLat });
      return;
    }
    const tLayers = ["theater-core", "theater-ring"].filter((id) => map.getLayer(id));
    const tHit = coreHit.length
      ? coreHit
      : tLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: tLayers })
        : [];
    if (tHit.length) {
      const f = tHit[0];
      closeTourPopup();
      const coords = f.geometry.coordinates;
      state.tourPopup = new maplibregl.Popup({ closeButton: true, maxWidth: "360px", offset: 14 })
        .setLngLat(coords)
        .setHTML(theaterPopupHtml(f.properties))
        .addTo(map);
      return;
    }
    onMapBackgroundClick(e);
  });
  ["ev-point", "ev-live-core", "ev-live-ring", "theater-ring", "theater-core"].forEach((layer) => {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  });

  state.mapReady = true;
  ensureGazetteerCityLabels();
  applyPlaceLabelLang();
  initCosmos();
  // dev 模式：暴露 map 实例供 B2 测量脚本触发程序化 zoom
  if (import.meta.env?.DEV) window.__crisisMap = map;
  // 默认平面 + 卫星地表
  applyMapMode("flat", { silent: true });
  applySurfaceMode("sat", { silent: true });
  startLivePulse();
  await refresh();
  loadTheaters();
  setInterval(loadTheaters, 600000);
  setInterval(refresh, 20000);
  setInterval(loadHealth, 30000);
  // 每 5 秒重算闪烁态：新灾害闪完后恢复静态类型色点
  setInterval(() => {
    // 只在有闪烁态需要过期时才全量重算，避免无谓重渲染
    if (state.lastFeatures.length && (blinkStartedAt.size || breakingBlinkUntil.size)) {
      applyFeatures(state.lastFeatures);
    }
  }, 5000);
  loadHealth();
  connectWS();
});

/* 投影切换锁，避免连点打断动画 */

document.getElementById("btnGlobal").addEventListener("click", () => setView("global"));
document.getElementById("btnLocal").addEventListener("click", () => setView("local"));

/* ========== 战区基线层（/api/theaters）：独立图层，不进事件统计 ========== */

/* ========== 事件拉取：首轮全量（summary），之后按 since 增量合并 ========== */

// 空格：巡览；Esc：退出预览
window.addEventListener(
  "keydown",
  (e) => {
    const tag = (e.target && e.target.tagName) || "";
    const typing =
      tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable;

    if (e.code === "Escape" || e.key === "Escape") {
      const searchEl = document.getElementById("eventSearch");
      if (searchEl && document.activeElement === searchEl && String(state.searchRaw || "").trim()) {
        e.preventDefault();
        searchEl.value = "";
        setSearchQuery("");
        return;
      }
      e.preventDefault();
      exitTourMode();
      return;
    }

    if (!typing && (e.key === "/" || e.code === "Slash") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const searchEl = document.getElementById("eventSearch");
      if (searchEl) {
        e.preventDefault();
        searchEl.focus();
        searchEl.select();
      }
      return;
    }

    if (e.code !== "Space" && e.key !== " ") return;
    if (typing) return;
    e.preventDefault();
    tourNextEvent();
  },
  { passive: false },
);

document.getElementById("btnFlat").addEventListener("click", () => applyMapMode("flat"));
document.getElementById("btnGlobe").addEventListener("click", () => applyMapMode("globe"));
document.getElementById("btnSat").addEventListener("click", () => applySurfaceMode("sat"));
document.getElementById("btnTopo").addEventListener("click", () => applySurfaceMode("topo"));
const btnPanelsEl = document.getElementById("btnPanels");
if (btnPanelsEl) {
  btnPanelsEl.addEventListener("click", () => {
    setPanelsCollapsed(!state.panelsCollapsed, { toast: false });
  });
}

// 界面语言 + 地图地名
document.querySelectorAll("[data-lang]").forEach((btn) => {
  btn.addEventListener("click", () => applyUiLang(btn.dataset.lang, { toast: true }));
});
// 先恢复面板折叠态，再套语言（会刷新按钮文案）
setPanelsCollapsed(state.panelsCollapsed, { persist: false });
applyUiLang(getLang(), { toast: false });
{
  const form = document.getElementById("searchForm");
  const input = document.getElementById("eventSearch");
  const clear = document.getElementById("searchClear");
  let searchTimer = 0;
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (input) setSearchQuery(input.value);
    });
  }
  if (input) {
    input.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => setSearchQuery(input.value), 120);
    });
  }
  if (clear) {
    clear.addEventListener("click", () => {
      if (input) input.value = "";
      setSearchQuery("");
      if (input) input.focus();
    });
  }
}
initDockablePanels({
  getTitle(key, fallback) {
    const pack = UI_I18N[getLang()] || UI_I18N.zh;
    return pack[key] || (getLang() === "en" ? fallback.en : fallback.zh);
  },
});

["f-natural", "f-conflict"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    applyFeatures(state.lastFeatures);
    syncTheaterLayer();
  });
});
bindTimeRangeButtons();

// 类型图层：全选 / 全不选 / 反选
const btnTypesAll = document.getElementById("btnTypesAll");
const btnTypesNone = document.getElementById("btnTypesNone");
const btnTypesInvert = document.getElementById("btnTypesInvert");
if (btnTypesAll) {
  btnTypesAll.addEventListener("click", () => setAllTypeFilters(true));
}
if (btnTypesNone) {
  btnTypesNone.addEventListener("click", () => setAllTypeFilters(false));
}
if (btnTypesInvert) {
  btnTypesInvert.addEventListener("click", () => setInvertTypeFilters());
}

// 初始渲染类型筛选 UI（在首批事件到达前也要有勾选框）
renderTypeLegend();

// Vite 模块作用域：供 HTML onclick 调用
// 窄屏底部标签：body[data-mtab] 决定哪个面板作为抽屉显示
const mobileTabs = document.getElementById("mobileTabs");
if (mobileTabs) {
  const setTab = (name) => {
    document.body.dataset.mtab = name;
    mobileTabs.querySelectorAll("button[data-mtab]").forEach((b) => {
      const on = b.dataset.mtab === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    try {
      map.resize();
    } catch (_) {}
  };
  mobileTabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mtab]");
    if (b) setTab(b.dataset.mtab);
  });
  setTab("feed");
}

// 事件流：事件委托（列表每 20 秒重绘，不能逐项绑定；也不再挂 window 全局）
const feedBody = document.getElementById("fbody");
if (feedBody) {
  feedBody.setAttribute("role", "listbox");
  const jump = (el) => {
    const id = el?.getAttribute("data-id");
    if (id == null) return;
    tourJumpToId(Number.isFinite(Number(id)) && String(Number(id)) === id ? Number(id) : id);
  };
  feedBody.addEventListener("click", (e) => jump(e.target.closest(".item[data-id]")));
  feedBody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest(".item[data-id]");
    if (!el) return;
    e.preventDefault();
    jump(el);
  });
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) pumpBreakingQueue();
});

if (import.meta.env?.DEV) {
  window.__crisisDebugBreaking = (id) => {
    const f = state.lastEnrichedPoints.find((x) => String(x.properties.id) === String(id));
    if (f) enqueueBreakingAlerts([f]);
    return Boolean(f);
  };
  window.__crisisDebugDwellMs = (p) => breakingDwellMs(p);
  window.__crisisDebugPopup = (id) => {
    const f = state.lastEnrichedPoints.find((x) => String(x.properties.id) === String(id));
    if (!f) return false;
    showEventPopup(f.properties, f.geometry.coordinates);
    return true;
  };
}
