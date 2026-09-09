/** 巡览：时间序/区域锁定、空格预览、点击地图国家面、飞行。 */
import { cancelBreakingDwell, pumpBreakingQueue } from "../breaking.js";
import { LOCAL_CENTER } from "../constants.js";
import { countryLabel } from "../grade.js";
import { refreshEffectsFocus } from "../map/effects.js";
import { map } from "../map/instance.js";
import { renderFeed, showToast } from "../panels/index.js";
import { closeTourPopup, showEventPopup } from "../popup/index.js";
import { state } from "../state.js";
import { byTimeDesc, haversineKm } from "../util/format.js";

/**
 * 重建巡览列表
 * - time：全局按发生时间新→旧
 * - region：锁定国家（或点击点周围半径）内按时间新→旧
 */
function rebuildTourList(enriched, opts = {}) {
  let list = (enriched || []).filter(
    (f) => f.geometry && f.geometry.type === "Point" && Array.isArray(f.geometry.coordinates),
  );

  if (state.tourScope === "region" && state.tourFocus) {
    if (state.tourFocus.country) {
      list = list.filter(
        (f) => String(f.properties.country || "") === String(state.tourFocus.country),
      );
    } else if (state.tourFocus.lon != null && state.tourFocus.lat != null) {
      const R = state.tourFocus.radiusKm || 1200;
      list = list.filter((f) => {
        const [lo, la] = f.geometry.coordinates;
        return haversineKm(state.tourFocus.lon, state.tourFocus.lat, lo, la) <= R;
      });
    }
  }

  list.sort(byTimeDesc);
  state.tourList = list;

  if (opts.anchorId != null) {
    const idx = state.tourList.findIndex((f) => String(f.properties.id) === String(opts.anchorId));
    state.tourIndex = idx >= 0 ? idx : -1;
    if (idx >= 0) state.tourActiveId = opts.anchorId;
  } else if (state.tourActiveId != null) {
    const idx = state.tourList.findIndex(
      (f) => String(f.properties.id) === String(state.tourActiveId),
    );
    if (idx >= 0) state.tourIndex = idx;
  }

  updateTourProgress();
  return state.tourList;
}

/** 鼠标点选事件/区域后，锁定区域巡览 */
function setTourRegionFocus(focus, opts = {}) {
  state.tourScope = "region";
  state.tourFocus = focus;
  rebuildTourList(state.lastEnrichedPoints, { anchorId: opts.anchorId });
  const liveCount = state.tourList.filter((x) => Number(x.properties.is_live) === 1).length;
  renderFeed(state.tourList.slice(0, 60), liveCount);
  const name = focus.name || countryLabel(focus.country) || "选定区域";
  const n = state.tourList.length;
  if (!opts.silent) {
    showToast("区域巡览", `已锁定「${name}」· 当前时段 ${n} 条 · 空格按时间顺序预览`);
  }
}

/** 恢复全局时间巡览 */
function setTourTimeScope(opts = {}) {
  state.tourScope = "time";
  state.tourFocus = null;
  rebuildTourList(state.lastEnrichedPoints, opts);
  const liveCount = state.tourList.filter((x) => Number(x.properties.is_live) === 1).length;
  renderFeed(state.tourList.slice(0, 60), liveCount);
  if (!opts.silent) {
    showToast("时间巡览", "已按最新灾害时间顺序预览");
  }
}

function highlightTourItem(id) {
  document
    .querySelectorAll(".item.tour-active")
    .forEach((el) => el.classList.remove("tour-active"));
  if (id == null) return;
  const el = document.querySelector(`.item[data-id="${id}"]`);
  if (el) {
    el.classList.add("tour-active");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function updateTourProgress() {
  const el = document.getElementById("tourProgress");
  if (!el) return;
  if (!state.tourList.length) {
    el.textContent =
      state.tourScope === "region"
        ? `区域无事件（${state.tourFocus?.name || countryLabel(state.tourFocus?.country) || "已锁定"}）`
        : "";
    return;
  }
  const scopeLabel =
    state.tourScope === "region"
      ? state.tourFocus?.name || countryLabel(state.tourFocus?.country) || "区域"
      : "时间序";
  if (state.tourIndex < 0) {
    el.textContent = `${scopeLabel} · 共 ${state.tourList.length} 处`;
  } else {
    el.textContent = `${scopeLabel} · ${state.tourIndex + 1} / ${state.tourList.length}`;
  }
}

/** 按灾害严重度决定拉近层级（类谷歌地图 magnify） */
function zoomForEvent(f) {
  const sev = Number(f.properties.severity) || 0;
  const t = f.properties.type;
  if (t === "earthquake") {
    if (sev >= 0.7) return 6.8;
    if (sev >= 0.4) return 7.4;
    return 8.2; // 小震更近
  }
  if (t === "cyclone") return 5.6;
  if (t === "wildfire" || t === "volcano") return 7.0;
  if (t === "flood" || t === "rainstorm") return 7.2;
  if (t === "crisis_signal" || t === "armed_clash") return 5.2;
  return 6.5;
}

function flyPromise(opts) {
  return new Promise((resolve) => {
    if (!state.mapReady) {
      resolve();
      return;
    }
    map.stop();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      map.off("moveend", finish);
      resolve();
    };
    map.once("moveend", finish);
    map.flyTo({ essential: true, ...opts });
    // 兜底：避免 moveend 偶发不触发
    setTimeout(finish, (opts.duration || 1500) + 800);
  });
}

/**
 * 空格巡览：
 * - 默认 / 首次：全局按时间新→旧
 * - 鼠标点过事件或国家后：锁定该国（或就近范围）内按时间新→旧
 * 动画：先略拉远再飞入并弹窗
 */
async function tourNextEvent() {
  if (!state.mapReady) return;
  if (state.tourFlying) return;

  // 首次空格：确保时间序巡览列表
  if (!state.tourMode && state.tourScope === "time") {
    rebuildTourList(state.lastEnrichedPoints);
  }

  if (!state.tourList.length) {
    const tip =
      state.tourScope === "region"
        ? `「${state.tourFocus?.name || countryLabel(state.tourFocus?.country) || "该区域"}」在当前时段没有灾害事件`
        : "当前筛选下没有可巡览的灾害事件";
    showToast("空格巡览", tip);
    return;
  }

  // 第一次从 0 开始（最新），之后按时间往更旧循环
  if (state.tourIndex < 0) state.tourIndex = 0;
  else state.tourIndex = (state.tourIndex + 1) % state.tourList.length;

  const f = state.tourList[state.tourIndex];
  if (!f || !f.geometry || !f.geometry.coordinates) return;
  const [lon, lat] = f.geometry.coordinates;
  const targetZoom = zoomForEvent(f);

  state.tourFlying = true;
  state.tourMode = true;
  state.tourActiveId = f.properties.id;
  closeTourPopup();
  updateTourProgress();
  highlightTourItem(f.properties.id);

  try {
    const curZoom = map.getZoom();
    // 1) 已处于放大态时先拉远，形成谷歌地图式「退一步再飞」
    if (curZoom > 3.8) {
      const mid = map.getCenter();
      // 朝下一目标方向略作过渡中心，避免生硬
      const midLon = mid.lng * 0.55 + lon * 0.45;
      const midLat = mid.lat * 0.55 + lat * 0.45;
      await flyPromise({
        center: [midLon, midLat],
        zoom: Math.max(2.0, Math.min(curZoom - 2.8, 3.6)),
        duration: 850,
        curve: 1.2,
        easing: (t) => t * (2 - t),
      });
    }

    // 2) 飞入目标灾害位置并放大
    await flyPromise({
      center: [lon, lat],
      zoom: targetZoom,
      duration: 2000,
      curve: 1.42,
      speed: 0.75,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });

    // 3) 自动弹出该灾害信息框
    showEventPopup(f.properties, [lon, lat]);
  } finally {
    state.tourFlying = false;
    updateTourProgress();
    pumpBreakingQueue();
  }
}

function flyTo(lon, lat) {
  map.flyTo({ center: [lon, lat], zoom: 5.2, duration: 1200, essential: true });
}

/**
 * 点击列表/地图事件：
 * 1) 锁定该事件所在国家（或就近范围）为巡览区域
 * 2) 区域列表按时间排序，锚到该条
 * 3) 飞入并弹窗；之后空格在区域内按时间继续
 */
async function tourJumpToId(id) {
  state.breakingCruisePaused = true;
  cancelBreakingDwell();
  const all = state.lastEnrichedPoints;
  const f = all.find((x) => String(x.properties.id) === String(id));
  if (!f) return;
  const [lon, lat] = f.geometry.coordinates;
  const country = f.properties.country || null;
  setTourRegionFocus(
    {
      country,
      lon,
      lat,
      name: country ? countryLabel(country) : "就近海域",
      radiusKm: country ? null : 1200,
    },
    { anchorId: id, silent: false },
  );

  // 锚在当前条，tourNext 先不 +1：直接飞当前条
  const idx = state.tourList.findIndex((x) => String(x.properties.id) === String(id));
  if (idx < 0) {
    showToast("区域巡览", "该事件不在可巡览列表中");
    return;
  }
  state.tourIndex = idx - 1;
  await tourNextEvent();
}

/** 点击地图空白处的国家面：锁定该国时间序巡览 */
function onMapBackgroundClick(e) {
  // 若点到灾害点，由事件图层处理
  const hitEv = map.queryRenderedFeatures(e.point, {
    layers: ["ev-point", "ev-live-core", "ev-live-ring"].filter((id) => map.getLayer(id)),
  });
  if (hitEv && hitEv.length) return;

  const hits = map.queryRenderedFeatures(e.point, {
    layers: ["country-fill"].filter((id) => map.getLayer(id)),
  });
  if (!hits.length) {
    // 点到海洋：以点击点为中心的就近范围
    setTourRegionFocus(
      {
        country: null,
        lon: e.lngLat.lng,
        lat: e.lngLat.lat,
        name: "就近海域",
        radiusKm: 1200,
      },
      { silent: false },
    );
    state.tourIndex = -1;
    state.tourActiveId = null;
    highlightTourItem(null);
    renderFeed(
      state.tourList.slice(0, 60),
      state.tourList.filter((x) => x.properties.is_live).length,
    );
    return;
  }
  const iso = hits[0].properties && (hits[0].properties.iso3 || hits[0].properties.ADM0_A3);
  if (!iso) return;
  setTourRegionFocus(
    {
      country: iso,
      lon: e.lngLat.lng,
      lat: e.lngLat.lat,
      name: countryLabel(iso),
    },
    { silent: false },
  );
  state.tourIndex = -1;
  state.tourActiveId = null;
  highlightTourItem(null);
  renderFeed(
    state.tourList.slice(0, 60),
    state.tourList.filter((x) => x.properties.is_live).length,
  );
}

/** 退出空格预览模式（Esc）→ 回到全局时间序 */
async function exitTourMode() {
  if (!state.tourMode && state.tourIndex < 0 && !state.tourPopup && state.tourScope === "time") {
    closeTourPopup();
    return;
  }
  if (state.tourFlying) {
    try {
      map.stop();
    } catch (_) {}
  }
  state.tourFlying = false;
  state.tourMode = false;
  state.tourIndex = -1;
  state.tourActiveId = null;
  state.tourScope = "time";
  state.tourFocus = null;
  closeTourPopup();
  highlightTourItem(null);
  if (state._eqWaveTimer) {
    cancelAnimationFrame(state._eqWaveTimer);
    state._eqWaveTimer = null;
  }
  state._eqWaveExtras = [];
  refreshEffectsFocus(null);
  rebuildTourList(state.lastEnrichedPoints);
  renderFeed(
    state.tourList.slice(0, 60),
    state.tourList.filter((x) => x.properties.is_live).length,
  );
  updateTourProgress();

  // 回到总览视距（平面 / 地球仪各自合适缩放）
  const overviewZoom =
    state.mapMode === "globe"
      ? state.currentView === "local"
        ? 2.3
        : 1.35
      : state.currentView === "local"
        ? 3.4
        : 1.55;
  const center = state.currentView === "local" ? LOCAL_CENTER : [20, 25];
  await flyPromise({
    center,
    zoom: overviewZoom,
    pitch: 0,
    duration: 1100,
    curve: 1.3,
    easing: (t) => 1 - Math.pow(1 - t, 2.5),
  });
  showToast("巡览", "已退出空格预览，回到总览");
}

export {
  rebuildTourList,
  setTourRegionFocus,
  setTourTimeScope,
  highlightTourItem,
  updateTourProgress,
  zoomForEvent,
  flyPromise,
  tourNextEvent,
  flyTo,
  tourJumpToId,
  onMapBackgroundClick,
  exitTourMode,
};
