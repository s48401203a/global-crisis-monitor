/** 侧栏面板：事件流、类型图例与开关、面板收起、搜索状态条、toast。 */
import { syncTheaterLayer } from "../api/client.js";
import { FILTERABLE_TYPES, TYPE_COLORS, TYPE_COLOR_DEFAULT } from "../constants.js";
import {
  countryLabel,
  isMinorCmaAlert,
  normalizeEventFeature,
  realGrade,
  sourceLabel,
  typeColor,
  typeLabel,
  typeTextStyle,
} from "../grade.js";
import { L, UI_I18N, getLang } from "../i18n/index.js";
import { map } from "../map/instance.js";
import { applyFeatures, inLocal } from "../pipeline.js";
import { resolvePlaceFromValues } from "../region-gazetteer.js";
import { state } from "../state.js";
import { setPref } from "../storage.js";
import { escapeHtml, fmtTime } from "../util/format.js";
import { eventHeadline } from "../headline.js";
import { buildBrief } from "../brief.js";

function persistTypeFilters() {
  setPref("typeFilters", state.typeFilterEnabled);
}

function isTypeEnabled(t) {
  if (!t) return true;
  if (Object.prototype.hasOwnProperty.call(state.typeFilterEnabled, t)) {
    return state.typeFilterEnabled[t] !== false;
  }
  // 未知类型：跟所属大类走，默认显示
  return true;
}

function setTypeFilter(type, on, { apply = true } = {}) {
  if (!Object.prototype.hasOwnProperty.call(state.typeFilterEnabled, type)) return;
  state.typeFilterEnabled[type] = Boolean(on);
  persistTypeFilters();
  const input = document.getElementById(`f-type-${type}`);
  if (input) input.checked = state.typeFilterEnabled[type];
  if (apply && state.lastFeatures.length) applyFeatures(state.lastFeatures);
  if (type === "theater") syncTheaterLayer();
}

function setAllTypeFilters(on, { category = null } = {}) {
  for (const it of FILTERABLE_TYPES) {
    if (category && it.category !== category) continue;
    state.typeFilterEnabled[it.type] = Boolean(on);
  }
  persistTypeFilters();
  renderTypeLegend();
  if (state.lastFeatures.length) applyFeatures(state.lastFeatures);
}

/** 反选：逐类型翻转开关状态 */
function setInvertTypeFilters() {
  for (const it of FILTERABLE_TYPES) {
    state.typeFilterEnabled[it.type] = !state.typeFilterEnabled[it.type];
  }
  persistTypeFilters();
  renderTypeLegend();
  if (state.lastFeatures.length) applyFeatures(state.lastFeatures);
}

/**
 * 类型图层筛选 UI（可勾选；配色点 + 数量）
 * 取代只读图例；地震震级色见 #eqGradeHint
 */
function renderTypeLegend() {
  const el = document.getElementById("typeLegend");
  if (!el) return;

  // 全量统计（不含蓝/黄日常预警；暴雨从洪水中拆出）
  const counts = {};
  for (const it of FILTERABLE_TYPES) counts[it.type] = 0;
  for (const f of state.lastFeatures) {
    const nf = normalizeEventFeature(f);
    if (isMinorCmaAlert(nf.properties || {})) continue;
    const t = nf.properties && nf.properties.type;
    if (t && counts[t] != null) counts[t] += 1;
  }

  el.innerHTML = FILTERABLE_TYPES.map((it) => {
    const checked = isTypeEnabled(it.type) ? "checked" : "";
    const color = TYPE_COLORS[it.type] || TYPE_COLOR_DEFAULT;
    const label = typeLabel(it.type);
    const n = it.layer ? state.theaterFeatures.length : counts[it.type] || 0;
    const offCls = isTypeEnabled(it.type) ? "" : " is-off";
    const title = it.layer ? L().theaterNote : label;
    return `
    <label class="legend-item legend-filter${offCls}${it.layer ? " legend-layer" : ""}" data-type="${escapeHtml(it.type)}" title="${escapeHtml(title)}">
      <input type="checkbox" id="f-type-${escapeHtml(it.type)}" data-type-filter="${escapeHtml(it.type)}" ${checked} />
      <span class="legend-dot" style="background:${color};color:${color}"></span>
      <span class="legend-lab">${escapeHtml(label)}</span>
      <span class="legend-cnt" id="cnt-type-${escapeHtml(it.type)}">${n}</span>
    </label>`;
  }).join("");

  el.querySelectorAll("input[data-type-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      const t = input.getAttribute("data-type-filter");
      setTypeFilter(t, input.checked, { apply: true });
      const row = input.closest(".legend-filter");
      if (row) row.classList.toggle("is-off", !input.checked);
    });
  });
}

/** 同步全局信息面板按钮文案/状态；顶部控制条始终保留以便恢复。 */
function updatePanelsToggleButton() {
  const button = document.getElementById("btnPanels");
  if (!button) return;
  const pack = UI_I18N[getLang()] || UI_I18N.zh;
  const key = state.panelsCollapsed ? "panelsShow" : "panelsHide";
  const titleKey = state.panelsCollapsed ? "panelsShowTitle" : "panelsHideTitle";
  const label = button.querySelector(".panel-toggle-label");
  const icon = button.querySelector(".panel-toggle-icon");
  if (label) label.textContent = pack[key] || (state.panelsCollapsed ? "展开面板" : "收起面板");
  if (icon) icon.textContent = state.panelsCollapsed ? "▣" : "▤";
  button.title = pack[titleKey] || "";
  button.setAttribute("aria-label", pack[titleKey] || pack[key] || "");
  button.setAttribute("aria-pressed", state.panelsCollapsed ? "true" : "false");
  button.classList.toggle("collapsed", state.panelsCollapsed);
}

/**
 * 一键收起/展开浮动信息面板（统计、筛选、健康、事件流、巡览条、免责声明）。
 * 顶栏控制条与地图控件始终保留。
 */
function setPanelsCollapsed(collapsed, { persist = true, toast = false } = {}) {
  state.panelsCollapsed = Boolean(collapsed);
  document.body.classList.toggle("panels-collapsed", state.panelsCollapsed);
  if (persist) {
    setPref("panelsCollapsed", state.panelsCollapsed);
  }
  updatePanelsToggleButton();
  // 面板显隐后触发地图重算尺寸，避免黑边/空白
  if (state.mapReady && map) {
    try {
      requestAnimationFrame(() => {
        try {
          map.resize();
        } catch (_) {}
      });
    } catch (_) {}
  }
  if (toast) {
    const pack = UI_I18N[getLang()] || UI_I18N.zh;
    showToast(
      getLang() === "en" ? "Panels" : "信息面板",
      state.panelsCollapsed
        ? pack.panelsHideTitle || (getLang() === "en" ? "Panels hidden" : "已收起信息面板")
        : pack.panelsShowTitle || (getLang() === "en" ? "Panels shown" : "已展开信息面板"),
    );
  }
}

function recognizedSearchPlace() {
  if (!state.searchParsed) return null;
  for (const group of state.searchParsed) {
    const values = [];
    for (const term of group) {
      if (term.negate) continue;
      if (term.field && term.field !== "country") continue;
      values.push(term.value);
    }
    const place = resolvePlaceFromValues(values);
    if (place) return place;
  }
  return null;
}

function syncSearchChrome(hitCount, poolCount) {
  const input = document.getElementById("eventSearch");
  const clear = document.getElementById("searchClear");
  const meta = document.getElementById("searchMeta");
  const active = Boolean(state.searchParsed);
  if (clear) clear.hidden = !String(state.searchRaw || "").trim();
  if (meta) {
    if (active && Number.isFinite(hitCount) && Number.isFinite(poolCount)) {
      const pack = UI_I18N[getLang()] || UI_I18N.zh;
      meta.hidden = false;
      const place = recognizedSearchPlace();
      if (place && hitCount === 0) {
        meta.textContent = `${place.label} · ${pack.searchLocated || "已定位"} · ${pack.searchNoEvent || "无事件"}`;
      } else if (place) {
        meta.textContent = `${place.label} · ${hitCount}${getLang() === "en" ? "" : " 条"}`;
      } else {
        meta.textContent = `${pack.searchHits || "命中"} ${hitCount}/${poolCount}`;
      }
    } else {
      meta.hidden = true;
      meta.textContent = "";
    }
  }
  const miss = active && hitCount === 0 && !recognizedSearchPlace();
  if (input) input.setAttribute("aria-invalid", miss ? "true" : "false");
}

function renderFeed(feats, liveCount) {
  const box = document.getElementById("fbody");
  const liveHint = liveCount > 0 ? ` · ${L().liveCount(liveCount)}` : "";
  const scopeHint =
    state.tourScope === "region"
      ? ` · ${state.tourFocus?.name || countryLabel(state.tourFocus?.country) || (getLang() === "en" ? "Region" : "区域")}`
      : ` · ${L().latest}`;
  document.getElementById("feedCount").textContent =
    `${L().items(feats.length)}${scopeHint}${liveHint}`;
  if (!feats.length) {
    const place = state.searchParsed ? recognizedSearchPlace() : null;
    const emptyText = place
      ? L().placeEmpty(place.label)
      : state.searchParsed
        ? L().emptySearch
        : L().emptyEvents;
    box.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
    return;
  }
  // 时间新→旧（state.tourList 已排序）
  const sorted = feats;
  box.innerHTML = sorted
    .map((f, i) => {
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      const live = Number(p.is_live) === 1;
      const active = state.tourActiveId != null && p.id === state.tourActiveId;
      const localBadge =
        state.currentView === "local" && inLocal(lon, lat)
          ? `<span style="color:var(--cyan)">· ${getLang() === "en" ? "Local" : "本地"}</span>`
          : "";
      const liveBadge = live
        ? `<span class="live-badge"><i></i>${getLang() === "en" ? "Live" : "进行中"}</span>`
        : "";
      const tc = typeColor(p.type);
      const grade = realGrade(p);
      const typeStyle = typeTextStyle(p);
      return `
      <div class="item ${p.category}${live ? " live" : ""}${active ? " tour-active" : ""}${p.status === "closed" ? " closed" : ""}"
           data-id="${p.id}"
           style="animation-delay:${Math.min(i, 12) * 0.04}s;--type-color:${tc}"
           role="option" tabindex="0" aria-selected="${active ? "true" : "false"}">
        <div class="type-row">
          <span class="tag t-${escapeHtml(p.type || "")}" style="${typeStyle}">${typeLabel(p.type)}</span>
          <span class="grade-badge g-${grade.tone}">${escapeHtml(grade.text)}</span>
          ${liveBadge}
        </div>
        <div class="title">${escapeHtml(eventHeadline(p))}</div>
        <div class="brief-line">${escapeHtml(buildBrief({ ...p, _lon: lon, _lat: lat }))}</div>
        <div class="meta">
          <span>${fmtTime(p.occurred_at)}</span>
          <span>${escapeHtml(sourceLabel(p.source))}</span>
          <span>${escapeHtml(countryLabel(p.country))}</span>
          ${localBadge}
        </div>
      </div>`;
    })
    .join("");
}

function showToast(title, text) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const key = `${title}\n${text}`;
  const now = Date.now();
  if (key === state.lastToastKey && now - state.lastToastAt < 2800) return;
  state.lastToastKey = key;
  state.lastToastAt = now;
  while (host.children.length >= 2) host.firstElementChild.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<div class="th">${escapeHtml(title)}</div><div class="tb">${escapeHtml(text)}</div>`;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 400);
  }, 5200);
}

export {
  renderFeed,
  renderTypeLegend,
  updatePanelsToggleButton,
  setPanelsCollapsed,
  syncSearchChrome,
  showToast,
  recognizedSearchPlace,
  isTypeEnabled,
  setTypeFilter,
  setAllTypeFilters,
  setInvertTypeFilters,
  persistTypeFilters,
};
