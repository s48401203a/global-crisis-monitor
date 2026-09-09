/** 后端交互：事件增量拉取（featureStore）、健康、战区层、WebSocket。 */
import { markBreakingBlink } from "../breaking.js";
import { featureStore } from "../constants.js";
import { sourceLabel } from "../grade.js";
import { L } from "../i18n/index.js";
import { map } from "../map/instance.js";
import { isTypeEnabled } from "../panels/index.js";
import { applyFeatures, selectedHours } from "../pipeline.js";
import { state } from "../state.js";
import { escapeHtml, fmtAge } from "../util/format.js";

async function loadTheaters() {
  try {
    const r = await fetch("/api/theaters", { cache: "no-store" });
    if (!r.ok) throw new Error("theaters " + r.status);
    const fc = await r.json();
    state.theaterFeatures = Array.isArray(fc.features) ? fc.features : [];
  } catch (e) {
    console.warn("theaters failed", e);
    state.theaterFeatures = [];
  }
  syncTheaterLayer();
  const cntEl = document.getElementById("cnt-type-theater");
  if (cntEl) cntEl.textContent = String(state.theaterFeatures.length);
}

function syncTheaterLayer() {
  if (!state.mapReady || !map.getSource("theaters")) return;
  const wantC = document.getElementById("f-conflict")?.checked !== false;
  const on = wantC && isTypeEnabled("theater");
  map.getSource("theaters").setData({
    type: "FeatureCollection",
    features: on ? state.theaterFeatures : [],
  });
}

function storeToArray() {
  return [...featureStore.values()];
}

function mergeIncremental(features) {
  let changed = 0;
  for (const f of features) {
    const p = f.properties || {};
    if (p.id == null) continue;
    if (p.status === "deleted") {
      if (featureStore.delete(p.id)) changed++;
      continue;
    }
    featureStore.set(p.id, f);
    changed++;
  }
  return changed;
}

async function refresh({ full = false } = {}) {
  // 全量拉取进行中时合并并发调用（启动阶段多处触发），避免重复 2 次全量
  if (state.refreshInFlight) return state.refreshInFlight;
  state.refreshInFlight = refreshBody({ full });
  try {
    return await state.refreshInFlight;
  } finally {
    state.refreshInFlight = null;
  }
}

async function refreshBody({ full = false } = {}) {
  const hours = selectedHours();
  try {
    // 开发模式：?fixtures=test 时加载本地测试夹具（手测台风轨迹/洪水箭头等 DB 无数据的路径）
    if (import.meta.env?.DEV && new URLSearchParams(location.search).get("fixtures") === "test") {
      const fr = await fetch(`/test-fixtures.json`, { cache: "no-store" });
      if (!fr.ok) throw new Error("fixtures " + fr.status);
      const fc = await fr.json();
      if (!fc || !Array.isArray(fc.features)) throw new Error("invalid fixtures payload");
      state.lastFeatures = fc.features;
      applyFeatures(state.lastFeatures);
      setLivePill(true);
      return;
    }
    const needFull = full || state.storeHours !== hours || !state.storeSince;
    const url = needFull
      ? `/api/events?hours=${hours}&limit=5000&fields=summary`
      : `/api/events?hours=${hours}&limit=5000&fields=summary&since=${encodeURIComponent(state.storeSince)}`;
    const er = await fetch(url, { cache: "no-store" });
    if (!er.ok) throw new Error("events " + er.status);
    const fc = await er.json();
    if (!fc || !Array.isArray(fc.features)) throw new Error("invalid events payload");
    if (needFull) {
      featureStore.clear();
      for (const f of fc.features)
        if (f.properties?.id != null) featureStore.set(f.properties.id, f);
      state.storeHours = hours;
    } else {
      mergeIncremental(fc.features);
    }
    if (fc.meta?.server_time) state.storeSince = fc.meta.server_time;
    state.lastFeatures = storeToArray();
    applyFeatures(state.lastFeatures);
    setLivePill(true);
  } catch (e) {
    console.warn("refresh failed", e);
    setLivePill(false);
  }
}

/** WS 通知后的增量刷新：合并 1.2 秒内的多次通知 */
function scheduleIncrementalRefresh() {
  clearTimeout(state.incrementalTimer);
  state.incrementalTimer = setTimeout(() => refresh(), 1200);
}

function setLivePill(ok) {
  const el = document.getElementById("livePill");
  if (!el) return;
  // 连接正常但采集管道 degraded/down 时，同样红显并说明原因
  const pipe = state.pipelineState.status;
  let label = ok ? L().live : L().connErr;
  let bad = !ok;
  if (ok && pipe === "down") {
    label = L().pipeline.down;
    bad = true;
  } else if (ok && pipe === "degraded") {
    label = L().pipeline.degraded(state.pipelineState.bad);
    bad = true;
  }
  el.classList.toggle("is-err", bad);
  el.title = bad ? label : "";
  el.innerHTML = bad
    ? `<span class="pulse" aria-hidden="true" style="background:var(--red);box-shadow:none"></span><span class="live-text">${escapeHtml(label)}</span>`
    : `<span class="pulse" aria-hidden="true"></span><span class="live-text">${escapeHtml(label)}</span>`;
}

function renderHealth(h) {
  const body = document.getElementById("hbody");
  if (!body || !h) return;
  if (!h.sources || !h.sources.length) {
    body.innerHTML = `<div class="empty">${escapeHtml(L().noSource)}</div>`;
    return;
  }
  const prevPipe = state.pipelineState.status;
  state.pipelineState = { status: h.pipeline_status || "ok", bad: h.pipeline_bad_sources || 0 };
  if (prevPipe !== state.pipelineState.status) setLivePill(true);
  const st = L().status;
  const rowHtml = (s, i) => {
    const dot = s.status === "ok" ? "ok" : s.status === "error" ? "err" : "off";
    const tail =
      s.status === "ok" || s.status === "error" ? fmtAge(s.age_seconds) : st[s.status] || s.status;
    const tip = [s.status_zh || st[s.status] || "", s.note_zh || "", s.last_error || ""]
      .filter(Boolean)
      .join(" · ");
    return `
      <div class="h-row h-${dot}" style="animation-delay:${i * 0.05}s" title="${escapeHtml(tip)}">
        <span class="dot ${dot}" aria-hidden="true"></span>
        <span class="h-name">${escapeHtml(sourceLabel(s.source))}<span class="sr-only"> · ${escapeHtml(st[s.status] || s.status)}</span></span>
        <span class="h-age">${escapeHtml(tail)}</span>
      </div>`;
  };
  const warnHtml = (h.warnings || [])
    .map(
      (w) => `<div class="h-warn">⚠ ${escapeHtml(L().healthWarn[w.code] || w.zh || w.code)}</div>`,
    )
    .join("");
  body.innerHTML =
    h.sources.map(rowHtml).join("") +
    warnHtml +
    `
      <div class="h-total">
        <span>库内事件总量</span>
        <b>${h.event_total ?? 0}</b>
      </div>`;
  const tick = document.getElementById("healthTick");
  if (tick) {
    tick.textContent = "已更新 " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }
}

async function loadHealth() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (!r.ok) throw new Error("health " + r.status);
    renderHealth(await r.json());
  } catch {
    const tick = document.getElementById("healthTick");
    if (tick) tick.textContent = "更新失败";
  }
}

function connectWS() {
  try {
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    );
    ws.onmessage = (e) => {
      let d = null;
      try {
        d = JSON.parse(e.data);
      } catch {
        d = null;
      }
      if (!d) return;
      const topic = d.topic || (d.event_id != null ? "alert" : "");
      if (topic === "alert") {
        const id = d.event_id ?? d.payload?.event_id;
        if (id != null) markBreakingBlink(id);
        scheduleIncrementalRefresh();
        loadHealth();
      } else if (topic === "events.changed") {
        scheduleIncrementalRefresh();
      } else if (topic === "pipeline.status") {
        loadHealth();
      }
    };
    ws.onopen = () => {
      try {
        ws.send("ping");
      } catch (_) {}
    };
    const ping = setInterval(() => {
      if (ws.readyState !== 1) {
        clearInterval(ping);
        return;
      }
      try {
        ws.send("ping");
      } catch (_) {}
    }, 25000);
    ws.onclose = () => {
      clearInterval(ping);
      setTimeout(connectWS, 5000);
    };
  } catch {
    setTimeout(connectWS, 5000);
  }
}

export {
  storeToArray,
  mergeIncremental,
  refresh,
  refreshBody,
  scheduleIncrementalRefresh,
  loadHealth,
  loadTheaters,
  connectWS,
  setLivePill,
  renderHealth,
  syncTheaterLayer,
};
