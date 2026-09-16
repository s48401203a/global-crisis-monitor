/** 事件弹窗：HTML、贴点定位、避让顶栏/侧栏、地震波动效。 */
import maplibregl from "maplibre-gl";
import { cancelBreakingDwell, isLiveEvent } from "../breaking.js";
import { TYPE_COLORS } from "../constants.js";
import { visibleShellInsets } from "../dock-panels.js";
import {
  catLabel,
  cmaSignalLevel,
  countryLabel,
  isCmaAlert,
  mapMarkerColor,
  parseMetrics,
  realGrade,
  sourceLabel,
  typeLabel,
  typeTextColor,
  typeTextStyle,
  unitLabel,
} from "../grade.js";
import { L, getLang } from "../i18n/index.js";
import { buildEffectFeatures, refreshEffectsFocus } from "../map/effects.js";
import { map } from "../map/instance.js";
import { state } from "../state.js";
import { highlightTourItem } from "../tour/index.js";
import { escapeHtml, fmtCoord, fmtNum, fmtTime } from "../util/format.js";
import { eventHeadline } from "../headline.js";
import { buildBrief } from "../brief.js";
import { eqImpactRadiusKm, makeCirclePolygon, parseFootprint } from "../util/geo.js";

function theaterPopupHtml(p) {
  const en = getLang() === "en";
  const name = en ? p.name_en || p.name_zh : p.name_zh || p.name_en;
  const lvl = L().theaterLevel[p.level] || p.level || "";
  const tone = p.level === "high" ? "red" : p.level === "medium" ? "orange" : "yellow";
  const note = en ? p.note_en || p.note_zh || "" : p.note_zh || p.note_en || "";
  return `
    <div class="popup-card">
      <div class="grade-line">
        <span class="ptag" style="color:${TYPE_COLORS.theater};border-color:${TYPE_COLORS.theater}">${escapeHtml(typeLabel("theater"))}</span>
        <span class="grade-badge g-${tone}">${escapeHtml(lvl)}</span>
      </div>
      <h4>${escapeHtml(name || "")}</h4>
      <div class="brief-box">${escapeHtml(note)}</div>
      <dl class="kv">
        <dt>${en ? "Region" : "区域"}</dt><dd>${escapeHtml(countryLabel(p.iso3))}</dd>
        <dt>${en ? "Updated" : "更新"}</dt><dd>${fmtTime(p.updated_at)}</dd>
      </dl>
      <div class="popup-foot">${escapeHtml(L().theaterNote)}</div>
    </div>`;
}

function buildPopupHtml(p) {
  const live = Number(p.is_live) === 1;
  const grade = realGrade(p);
  const typeC = typeTextColor(p);
  const brief = buildBrief(p);
  const mag = (() => {
    if (isCmaAlert(p) || p.unit === "alert") {
      const lv = cmaSignalLevel(p);
      return lv ? `${lv}色预警` : "—";
    }
    return p.magnitude != null && p.magnitude !== "null"
      ? `${p.magnitude} ${unitLabel(p.unit)}`
      : "—";
  })();
  const met = parseMetrics(p);
  const depth = met.depth_km != null ? `${fmtNum(met.depth_km)} km` : "—";
  const lon = Number(p._lon ?? 0);
  const lat = Number(p._lat ?? 0);
  let extraRows = "";
  if (p.type === "earthquake") {
    const r = eqImpactRadiusKm(p.magnitude);
    extraRows = `
        <dt>震中</dt><dd>${escapeHtml(fmtCoord(lat, lon))}</dd>
        <dt>震源深度</dt><dd>${escapeHtml(depth)}</dd>
        <dt>有感半径</dt><dd>约 ${r} km（经验估算，见地图影响圈）</dd>
        <dt>发生时刻</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
  } else if (p.type === "cyclone") {
    const fp = parseFootprint(p);
    const n = fp && fp.coordinates ? fp.coordinates.length : 0;
    extraRows = `
        <dt>当前位置</dt><dd>${escapeHtml(fmtCoord(lat, lon))}</dd>
        <dt>路径点</dt><dd>${n >= 2 ? `${n} 个（地图已标轨迹）` : "不足，仅当前位置"}</dd>
        <dt>发生/更新</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
  } else if (p.type === "rainstorm" || isCmaAlert(p)) {
    const lv = parseMetrics(p).cma_level;
    extraRows = `
        <dt>预警类型</dt><dd>${escapeHtml(typeLabel(p.type))}</dd>
        <dt>信号等级</dt><dd>${escapeHtml(lv ? `${lv}色` : "—")}</dd>
        <dt>发布位置</dt><dd>${escapeHtml(fmtCoord(lat, lon))}</dd>
        <dt>发布时间</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
  } else if (p.type === "flood" || p.type === "landslide" || p.type === "debris_flow") {
    extraRows = `
        <dt>监测点</dt><dd>${escapeHtml(fmtCoord(lat, lon))}</dd>
        <dt>发生/更新</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
  } else if (p.type === "war" || p.type === "crisis_signal" || p.type === "armed_clash") {
    extraRows = `
        <dt>区域</dt><dd>${escapeHtml(countryLabel(p.country))}</dd>
        <dt>冲突级别</dt><dd>国家/代理人/边境武装级（已过滤普通枪击）</dd>
        <dt>${p.is_aggregate || parseMetrics(p).aggregate ? "统计日" : "时间窗"}</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
  } else {
    extraRows = `
        <dt>位置</dt><dd>${escapeHtml(fmtCoord(lat, lon))}</dd>
        <dt>发生/更新</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
  }
  return `
    <div class="popup-card">
      <div class="grade-line">
        <span class="ptag" style="${typeTextStyle(p)}">${typeLabel(p.type)}</span>
        <span class="grade-badge g-${grade.tone}">${escapeHtml(grade.text)}</span>
        ${live ? '<span class="live-badge"><i></i>进行中</span>' : ""}
      </div>
      <h4>${escapeHtml(eventHeadline(p))}</h4>
      <div class="brief-box" title="一句话简报">${escapeHtml(brief)}</div>
      <dl>
        <dt>灾害类型</dt><dd><span style="color:${typeC};font-weight:650">${escapeHtml(typeLabel(p.type))}</span>（${escapeHtml(catLabel(p.category))}）</dd>
        <dt>真实等级</dt><dd>${escapeHtml(grade.text)}</dd>
        <dt>原始量级</dt><dd>${escapeHtml(String(mag))}</dd>
        ${extraRows}
        <dt>主来源</dt><dd>${escapeHtml(sourceLabel(p.source))}</dd>
        <dt>采集时间</dt><dd>${fmtTime(p.first_seen_at)}</dd>
        <dt>置信度</dt><dd>${p.confidence != null && Number.isFinite(Number(p.confidence)) ? Number(p.confidence).toFixed(2) : "-"}</dd>
      </dl>
    </div>`;
}

function closeTourPopup() {
  state.popupCloseFromCode = true;
  if (state.tourPopup) {
    try {
      state.tourPopup.remove();
    } catch (_) {}
    state.tourPopup = null;
  }
  document.querySelectorAll(".maplibregl-popup").forEach((el) => el.remove());
  state.popupCloseFromCode = false;
}

function popupTopPad() {
  const chrome = document.querySelector(".chrome-top");
  if (chrome) {
    const bottom = chrome.getBoundingClientRect().bottom;
    if (Number.isFinite(bottom) && bottom > 20) return Math.ceil(bottom) + 6;
  }
  const bar = document.querySelector(".topbar");
  return bar ? Math.ceil(bar.getBoundingClientRect().bottom) + 6 : 56;
}

function popupChromePad() {
  const inset = visibleShellInsets();
  return {
    top: Math.max(popupTopPad(), inset.top || 0),
    right: Math.max(10, inset.right || 0),
    bottom: Math.max(10, inset.bottom || 0),
    left: Math.max(10, inset.left || 0),
  };
}

function popupPixelOffset(p) {
  const live = Number(p?.is_live) === 1 || isLiveEvent(p);
  const sev = Number(p?.severity) || 0;
  const gap = live ? 8 + sev * 5 : 6 + sev * 2;
  return Math.round(Math.min(12, Math.max(6, gap)));
}

function pickPopupAnchor(lngLat) {
  const pt = map.project(lngLat);
  const pad = popupChromePad();
  const needH = Math.min(300, window.innerHeight * 0.4);
  const above = pt.y - pad.top;
  const below = window.innerHeight - pad.bottom - pt.y;
  const left = pt.x - pad.left;
  const right = window.innerWidth - pad.right - pt.x;
  let side;
  if (above < needH && below > 140) side = "top";
  else if (below < needH && above > 140) side = "bottom";
  else if (above >= needH) side = "bottom";
  else side = "top";
  if (right < 190 && left > right) return `${side}-right`;
  if (left < 190 && right > left) return `${side}-left`;
  return side;
}

function fitPopupHeight(popup) {
  const root = popup && popup.getElement && popup.getElement();
  const box = root && root.querySelector(".maplibregl-popup-content");
  if (!box) return;
  const pad = popupChromePad();
  const maxH = Math.max(160, window.innerHeight - pad.top - pad.bottom);
  box.style.maxHeight = `${Math.min(maxH, Math.round(window.innerHeight * 0.44))}px`;
}

function keepPopupPinnedToMarker(popup) {
  const root = popup && popup.getElement && popup.getElement();
  if (!root || !state.mapReady) return;
  const box = root.querySelector(".maplibregl-popup-content");
  if (box) box.style.transform = "";
  fitPopupHeight(popup);
  const r = root.getBoundingClientRect();
  const pad = popupChromePad();
  let dx = 0;
  let dy = 0;
  if (r.top < pad.top) dy += pad.top - r.top + 4;
  if (r.bottom > window.innerHeight - pad.bottom)
    dy -= r.bottom - (window.innerHeight - pad.bottom);
  if (r.left < pad.left) dx += pad.left - r.left;
  if (r.right > window.innerWidth - pad.right) dx -= r.right - (window.innerWidth - pad.right);
  if (!dx && !dy) return;
  if (Math.abs(dx) > 64) dx = Math.sign(dx) * 64;
  if (Math.abs(dy) > 80) dy = Math.sign(dy) * 80;
  map.panBy([dx, dy], { duration: 200, essential: true });
}

function openPinnedPopup(p, lon, lat, anchor) {
  const maxW = Math.max(240, Math.min(360, window.innerWidth - 28));
  return new maplibregl.Popup({
    closeButton: true,
    className: "crisis-popup",
    maxWidth: `${maxW}px`,
    offset: popupPixelOffset(p),
    anchor,
    focusAfterOpen: false,
  })
    .setLngLat([lon, lat])
    .setHTML(buildPopupHtml({ ...p, _lon: lon, _lat: lat }))
    .addTo(map);
}

function showEventPopup(p, lngLat, opts = {}) {
  const lon = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng;
  const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat;
  const props = { ...p, _lon: lon, _lat: lat };
  closeTourPopup();
  let anchor = pickPopupAnchor([lon, lat]);
  state.tourPopup = openPinnedPopup(props, lon, lat, anchor);
  const relayout = () => {
    if (!state.tourPopup) return;
    fitPopupHeight(state.tourPopup);
    const root = state.tourPopup.getElement();
    if (!root) return;
    const r = root.getBoundingClientRect();
    const pad = popupChromePad();
    if (r.top < pad.top - 2 && !String(anchor).startsWith("top")) {
      state.popupCloseFromCode = true;
      try {
        state.tourPopup.remove();
      } catch (_) {}
      state.popupCloseFromCode = false;
      anchor = pad.right > pad.left ? "top-right" : "top";
      state.tourPopup = openPinnedPopup(props, lon, lat, anchor);
      bindPopupClose(state.tourPopup, p, opts);
    } else if (r.right > window.innerWidth - pad.right + 4 && !String(anchor).endsWith("right")) {
      state.popupCloseFromCode = true;
      try {
        state.tourPopup.remove();
      } catch (_) {}
      state.popupCloseFromCode = false;
      anchor = String(anchor).startsWith("top") ? "top-right" : "bottom-right";
      state.tourPopup = openPinnedPopup(props, lon, lat, anchor);
      bindPopupClose(state.tourPopup, p, opts);
    }
    keepPopupPinnedToMarker(state.tourPopup);
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      relayout();
      setTimeout(relayout, 90);
    });
  });
  bindPopupClose(state.tourPopup, p, opts);
  state.tourActiveId = p.id;
  highlightTourItem(p.id);
  refreshEffectsFocus(p.id);
  startEqWavePulse(p.id);
}

function bindPopupClose(popup, p, opts = {}) {
  popup.on("close", () => {
    if (state._eqWaveTimer) {
      cancelAnimationFrame(state._eqWaveTimer);
      state._eqWaveTimer = null;
    }
    state._eqWaveExtras = [];
    if (state.tourActiveId != null && String(state.tourActiveId) === String(p.id)) {
      state.tourActiveId = null;
      refreshEffectsFocus(null);
    }
    if (!state.popupCloseFromCode && opts.fromBreaking) {
      state.breakingCruisePaused = true;
      cancelBreakingDwell();
    }
  });
}

function startEqWavePulse(focusId) {
  if (state._eqWaveTimer) {
    cancelAnimationFrame(state._eqWaveTimer);
    state._eqWaveTimer = null;
  }
  state._eqWaveExtras = [];
  if (!state.mapReady || !map.getLayer("fx-eq-fill")) return;

  const feat =
    focusId != null
      ? state.lastEnrichedPoints.find((f) => String(f.properties.id) === String(focusId))
      : null;
  const isEq = feat && feat.properties && feat.properties.type === "earthquake";
  const lon = isEq ? feat.geometry.coordinates[0] : null;
  const lat = isEq ? feat.geometry.coordinates[1] : null;
  const maxR = isEq ? eqImpactRadiusKm(feat.properties.magnitude) : 0;
  const color = isEq ? feat.properties.marker_color || mapMarkerColor(feat.properties) : "#f0b429";

  const tick = (ts) => {
    if (!state.mapReady || !map.getLayer("fx-eq-fill")) return;
    const s = 0.5 + 0.5 * Math.sin(((ts / 1000) * Math.PI * 2) / 1.8);
    try {
      map.setPaintProperty("fx-eq-fill", "fill-opacity", [
        "case",
        ["==", ["get", "focused"], 1],
        ["case", ["==", ["get", "ring"], "inner"], 0.12 + s * 0.22, 0.05 + s * 0.14],
        [
          "case",
          ["==", ["get", "ring"], "wave"],
          0.02 + s * 0.06,
          ["case", ["==", ["get", "ring"], "inner"], 0.1, 0.045],
        ],
      ]);
      map.setPaintProperty("fx-eq-line", "line-opacity", [
        "case",
        ["==", ["get", "ring"], "wave"],
        0.35 + s * 0.45,
        ["case", ["==", ["get", "focused"], 1], 0.45 + s * 0.5, 0.55],
      ]);
      map.setPaintProperty("fx-eq-line", "line-width", [
        "case",
        ["==", ["get", "ring"], "wave"],
        2.2,
        ["case", ["==", ["get", "ring"], "inner"], 1.6, 1.1],
      ]);
    } catch (_) {}

    // 聚焦地震：两道外扩冲击波（0→有感半径循环）
    if (isEq && lon != null && lat != null && maxR > 0) {
      const phase = (ts / 1000) % 2.4;
      const phase2 = (ts / 1000 + 1.2) % 2.4;
      const r1 = Math.max(2, (phase / 2.4) * maxR);
      const r2 = Math.max(2, (phase2 / 2.4) * maxR);
      const o1 = 1 - phase / 2.4;
      const o2 = 1 - phase2 / 2.4;
      state._eqWaveExtras = [
        {
          type: "Feature",
          geometry: makeCirclePolygon(lon, lat, r1, 48),
          properties: {
            effect: "eq_ring",
            ring: "wave",
            parent_id: focusId,
            marker_color: color,
            radius_km: r1,
            focused: 1,
            wave_opacity: o1,
          },
        },
        {
          type: "Feature",
          geometry: makeCirclePolygon(lon, lat, r2, 48),
          properties: {
            effect: "eq_ring",
            ring: "wave",
            parent_id: focusId,
            marker_color: color,
            radius_km: r2,
            focused: 1,
            wave_opacity: o2,
          },
        },
      ];
      // 约 100ms 更新一次几何，避免每帧 setData 过重
      if (!tick._lastPush || ts - tick._lastPush > 90) {
        tick._lastPush = ts;
        const base = buildEffectFeatures(state.lastEnrichedPoints, focusId);
        if (map.getSource("effects")) {
          map.getSource("effects").setData({
            type: "FeatureCollection",
            features: base.concat(state._eqWaveExtras),
          });
        }
      }
    }

    state._eqWaveTimer = requestAnimationFrame(tick);
  };
  state._eqWaveTimer = requestAnimationFrame(tick);
}

export {
  buildPopupHtml,
  theaterPopupHtml,
  closeTourPopup,
  popupTopPad,
  popupChromePad,
  popupPixelOffset,
  pickPopupAnchor,
  fitPopupHeight,
  keepPopupPinnedToMarker,
  openPinnedPopup,
  showEventPopup,
  bindPopupClose,
  startEqWavePulse,
};
