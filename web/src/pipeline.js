/** 事件管线：筛选（大类/类型/搜索/视图）→ enrich → 地图 source / 特效 / 巡览 / 事件流。 */
import { refresh, syncTheaterLayer } from "./api/client.js";
import { inTimeWindow } from "./api/sync.js";
import { detectAndQueueBreaking, isLiveEvent, pumpBreakingQueue } from "./breaking.js";
import {
  FILTERABLE_TYPES,
  LOCAL_BOUNDS,
  LOCAL_CENTER,
  TIME_RANGE_HOURS,
  blinkStartedAt,
} from "./constants.js";
import { matchSearchRecord, parseSearchQuery } from "./event-search.js";
import {
  ISO3_EN,
  ISO3_ZH,
  isMinorCmaAlert,
  mapMarkerColor,
  normalizeEventFeature,
} from "./grade.js";
import { EN, L, ZH } from "./i18n/index.js";
import { refreshEffectsFocus } from "./map/effects.js";
import { map } from "./map/instance.js";
import {
  isTypeEnabled,
  recognizedSearchPlace,
  renderFeed,
  syncSearchChrome,
} from "./panels/index.js";
import { placeBounds, placesAt } from "./region-gazetteer.js";
import { state } from "./state.js";
import { rebuildTourList } from "./tour/index.js";
import { byTimeDesc } from "./util/format.js";
import { eventHeadline } from "./headline.js";

function inLocal(lon, lat) {
  return (
    lon >= LOCAL_BOUNDS[0][0] &&
    lon <= LOCAL_BOUNDS[1][0] &&
    lat >= LOCAL_BOUNDS[0][1] &&
    lat <= LOCAL_BOUNDS[1][1]
  );
}

function setView(view) {
  state.currentView = view;
  document.querySelectorAll("[data-view]").forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.getElementById("viewHint").textContent =
    view === "local" ? L().viewLocal : L().viewGlobal;

  if (!state.mapReady) return;
  if (view === "local") {
    map.flyTo({ center: LOCAL_CENTER, zoom: 3.4, duration: 1400, essential: true });
    map.setPaintProperty("china-highlight", "line-width", 1.8);
    map.setPaintProperty("china-highlight", "line-opacity", 0.85);
  } else {
    map.flyTo({ center: [20, 25], zoom: 1.55, duration: 1400, essential: true });
    map.setPaintProperty("china-highlight", "line-width", 0);
    map.setPaintProperty("china-highlight", "line-opacity", 0);
  }
  applyFeatures(state.lastFeatures);
}

function selectedTimeRange() {
  const btn = document.querySelector("#hoursGroup button.active");
  const key = (btn && btn.getAttribute("data-range")) || "day";
  return TIME_RANGE_HOURS[key] ? key : "day";
}

function selectedHours() {
  const fn = TIME_RANGE_HOURS[selectedTimeRange()];
  return String(fn ? fn() : 24);
}

function bindTimeRangeButtons() {
  const group = document.getElementById("hoursGroup");
  if (!group) return;
  group.querySelectorAll("button[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      group.querySelectorAll("button[data-range]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      refresh({ full: true });
    });
  });
}

function searchRecordOf(f) {
  const p = (f && f.properties) || {};
  const iso = String(p.country || "").toUpperCase();
  const typeZh = ZH.types[p.type] || "";
  const typeEn = EN.types[p.type] || "";
  const catZh = ZH.cats[p.category] || "";
  const catEn = EN.cats[p.category] || "";
  const srcZh = ZH.sources[p.source] || "";
  const srcEn = EN.sources[p.source] || "";
  const ctryZh = ISO3_ZH[iso] || "";
  const ctryEn = ISO3_EN[iso] || "";
  const live = Number(p.is_live) === 1 || isLiveEvent(p);
  const headline = eventHeadline(p);
  const blob = [
    headline,
    p.headline,
    p.type,
    typeZh,
    typeEn,
    iso,
    ctryZh,
    ctryEn,
    p.source,
    srcZh,
    srcEn,
    p.category,
    catZh,
    catEn,
    p.magnitude,
    p.unit,
    p.status,
    live ? "live 进行中 实时" : "",
  ]
    .filter((x) => x != null && x !== "")
    .join("\n")
    .toLowerCase();
  const coords = (f && f.geometry && f.geometry.coordinates) || [];
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  const place = placesAt(lon, lat);
  const placeText = place.keywords || "";
  return {
    blob: [blob, placeText].filter(Boolean).join("\n").toLowerCase(),
    type: `${p.type || ""} ${typeZh} ${typeEn}`.toLowerCase(),
    country: `${iso} ${ctryZh} ${ctryEn} ${placeText}`.toLowerCase(),
    source: `${p.source || ""} ${srcZh} ${srcEn}`.toLowerCase(),
    cat: `${p.category || ""} ${catZh} ${catEn}`.toLowerCase(),
    headline: `${headline} ${p.headline || ""}`.toLowerCase(),
    mag: Number(p.magnitude),
    sev: Number(p.severity),
    lon,
    lat,
  };
}

function maybeFocusSearchPlace() {
  const place = recognizedSearchPlace();
  if (!place || !state.mapReady || !map) return;
  const b = placeBounds(place);
  if (!b) return;
  const [w, s, e, n] = b;
  try {
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 56, maxZoom: 7.4, duration: 900 },
    );
  } catch {
    /* fitBounds 在投影切换中可能失败 */
  }
}

function setSearchQuery(raw, { apply = true } = {}) {
  state.searchRaw = String(raw || "");
  state.searchParsed = parseSearchQuery(state.searchRaw);
  if (apply && state.lastFeatures.length) applyFeatures(state.lastFeatures);
  else syncSearchChrome();
  if (state.searchParsed) maybeFocusSearchPlace();
}

function applyFeatures(allRaw) {
  state.applyingFeatures = true;
  try {
    applyFeaturesBody(allRaw);
  } finally {
    state.applyingFeatures = false;
  }
  pumpBreakingQueue();
}

function usingFixtures() {
  try {
    return Boolean(
      import.meta.env?.DEV && new URLSearchParams(location.search).get("fixtures") === "test",
    );
  } catch {
    return false;
  }
}

function applyFeaturesBody(allRaw) {
  const hours = Number(selectedHours());
  const nowMs = Date.now();
  const all = (allRaw || []).map(normalizeEventFeature).filter((f) => {
    if (f.properties?.status === "deleted") return false;
    if (usingFixtures()) return true;
    return inTimeWindow(f, hours, nowMs);
  });
  const wantN = document.getElementById("f-natural")?.checked !== false;
  const wantC = document.getElementById("f-conflict")?.checked !== false;
  const notable = all.filter((f) => !isMinorCmaAlert(f.properties || {}));

  let feats = notable.filter((f) => {
    const p = f.properties || {};
    const c = p.category;
    const t = p.type;
    // 大类开关
    if (c === "natural" && !wantN) return false;
    if (c === "conflict" && !wantC) return false;
    // 类型图层开关（地震/野火/火山/洪水…）
    if (!isTypeEnabled(t)) return false;
    return true;
  });
  const afterLayer = feats.length;
  if (state.searchParsed) {
    feats = feats.filter((f) => matchSearchRecord(searchRecordOf(f), state.searchParsed));
  }
  syncSearchChrome(feats.length, afterLayer);

  // 右侧面板与巡览默认：一律按发生时间新→旧
  feats = [...feats].sort(byTimeDesc);

  // 本地专题：本地事件置顶，组内仍按时间
  if (state.currentView === "local") {
    feats = [...feats].sort((a, b) => {
      const al = inLocal(a.geometry.coordinates[0], a.geometry.coordinates[1]) ? 0 : 1;
      const bl = inLocal(b.geometry.coordinates[0], b.geometry.coordinates[1]) ? 0 : 1;
      if (al !== bl) return al - bl;
      return byTimeDesc(a, b);
    });
  }

  const nNat = notable.filter((f) => f.properties.category === "natural").length;
  const nCon = notable.filter((f) => f.properties.category === "conflict").length;
  const nHi = notable.filter((f) => Number(f.properties.severity) >= 0.7).length;
  document.getElementById("st-total").textContent = notable.length;
  document.getElementById("st-nat").textContent = nNat;
  document.getElementById("st-con").textContent = nCon;
  document.getElementById("st-hi").textContent = nHi;
  document.getElementById("cnt-nat").textContent = nNat;
  document.getElementById("cnt-con").textContent = nCon;

  // 各类型数量角标（不含蓝/黄日常预警）
  const typeCounts = {};
  for (const it of FILTERABLE_TYPES) typeCounts[it.type] = 0;
  for (const f of notable) {
    const t = f.properties && f.properties.type;
    if (t && typeCounts[t] != null) typeCounts[t] += 1;
  }
  for (const it of FILTERABLE_TYPES) {
    const cntEl = document.getElementById(`cnt-type-${it.type}`);
    if (cntEl)
      cntEl.textContent = String(
        it.layer ? state.theaterFeatures.length : typeCounts[it.type] || 0,
      );
  }
  syncTheaterLayer();

  detectAndQueueBreaking(feats);

  // is_live + marker_color（地图点色与列表/等级完全一致）
  const enriched = feats.map((f) => {
    const coords = f.geometry && f.geometry.coordinates;
    const p0 = {
      ...f.properties,
      _lon: coords ? coords[0] : f.properties._lon,
      _lat: coords ? coords[1] : f.properties._lat,
    };
    const live = isLiveEvent(p0);
    const p = p0;
    const mc = mapMarkerColor(p);
    return {
      ...f,
      properties: {
        ...p,
        is_live: live ? 1 : 0,
        confidence: (() => {
          const c = Number(p.confidence);
          return Number.isFinite(c) ? c : null;
        })(),
        severity: Number(p.severity) || 0,
        marker_color: mc,
      },
    };
  });
  state.lastEnrichedPoints = enriched.filter(
    (f) => f.geometry && f.geometry.type === "Point" && f.geometry.coordinates,
  );

  // 仅清理已彻底不在全量列表中的计时（筛选隐藏不重置，避免反复闪）
  for (const id of [...blinkStartedAt.keys()]) {
    if (!state.lastFeatures.some((f) => f.properties.id === id)) {
      blinkStartedAt.delete(id);
    }
  }

  const extra = [];
  for (const f of enriched) {
    let fp = f.properties.footprint;
    if (typeof fp === "string") {
      try {
        fp = JSON.parse(fp);
      } catch {
        fp = null;
      }
    }
    if (fp && fp.type === "LineString") {
      extra.push({
        type: "Feature",
        geometry: fp,
        properties: {
          id: f.properties.id,
          type: f.properties.type,
          category: f.properties.category,
          severity: f.properties.severity,
          confidence: 1,
          is_live: f.properties.is_live,
          marker_color: f.properties.marker_color || mapMarkerColor(f.properties),
          track_color: f.properties.marker_color || mapMarkerColor(f.properties),
        },
      });
    }
  }

  if (state.mapReady && map.getSource("events")) {
    map
      .getSource("events")
      .setData({ type: "FeatureCollection", features: [...enriched, ...extra] });
  }

  // 特效层：地震圈 / 台风轨迹始终重建；洪水方向随 zoom/聚焦显示
  refreshEffectsFocus(state.effectsFocusId != null ? state.effectsFocusId : state.tourActiveId);

  const liveCount = enriched.filter((f) => f.properties.is_live === 1).length;

  // 巡览列表：默认时间序；若已锁定区域则仅该国/就近范围 + 时间序
  rebuildTourList(state.lastEnrichedPoints);
  renderFeed(state.tourList.slice(0, 60), liveCount);
}

export {
  inLocal,
  setView,
  selectedTimeRange,
  selectedHours,
  bindTimeRangeButtons,
  searchRecordOf,
  maybeFocusSearchPlace,
  setSearchQuery,
  applyFeatures,
  applyFeaturesBody,
};
