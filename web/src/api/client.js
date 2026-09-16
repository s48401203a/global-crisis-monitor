/** 后端交互：事件快照/增量/对账、健康、战区层、WebSocket。 */
import { markBreakingBlink } from "../breaking.js";
import { featureStore } from "../constants.js";
import { sourceLabel } from "../grade.js";
import { L } from "../i18n/index.js";
import { map } from "../map/instance.js";
import { isTypeEnabled } from "../panels/index.js";
import { applyFeatures, selectedHours } from "../pipeline.js";
import { state } from "../state.js";
import { escapeHtml, fmtAge } from "../util/format.js";
import { auth } from "./auth.js";
import {
  PAGE_LIMIT,
  applyReconcile,
  buildEventsQuery,
  collectPages,
  cursorAfterReconcile,
  mergeIncremental,
  pruneStoreByWindow,
  replaceSnapshot,
  shouldAdvanceCursor,
  watermarkFromMeta,
} from "./sync.js";

function storeToArray() {
  return [...featureStore.values()];
}

async function apiFetch(url, init = {}) {
  const headers = auth.applyHeaders(new Headers(init.headers || {}));
  const r = await fetch(url, { ...init, headers });
  if (r.status !== 401) {
    if (r.ok) auth.noteSuccess();
    return r;
  }
  if (!auth.allowReconnect()) return r;
  const result = await auth.promptForToken("missing");
  if (!result.ok) return r;
  const retryHeaders = auth.applyHeaders(new Headers(init.headers || {}));
  const r2 = await fetch(url, { ...init, headers: retryHeaders });
  if (r2.status === 401) {
    await auth.noteInvalidCredentials();
  }
  return r2;
}

async function loadTheaters() {
  try {
    const r = await apiFetch("/api/theaters", { cache: "no-store" });
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

function publishStore() {
  pruneStoreByWindow(featureStore, Number(selectedHours()), Date.now());
  state.lastFeatures = storeToArray();
  applyFeatures(state.lastFeatures);
}

async function fetchJson(url) {
  const er = await apiFetch(url, { cache: "no-store" });
  if (er.status === 401) throw new Error("events 401");
  if (!er.ok) throw new Error("events " + er.status);
  return er.json();
}

function runSync(fn) {
  const start = () => {
    const p = Promise.resolve().then(fn);
    state.refreshInFlight = p.finally(() => {
      if (state.refreshInFlight === p) state.refreshInFlight = null;
    });
    return p;
  };
  if (state.refreshInFlight) return state.refreshInFlight.then(start, start);
  return start();
}

async function refresh({ full = false } = {}) {
  return runSync(() => refreshBody({ full }));
}

async function refreshBody({ full = false } = {}) {
  const hours = selectedHours();
  try {
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
    const needFull = full || state.storeHours !== hours || state.storeSeq == null;
    const collected = await collectPages(fetchJson, {
      hours,
      sinceSeq: needFull ? null : state.storeSeq,
      full: needFull,
      limit: PAGE_LIMIT,
    });
    if (needFull) {
      replaceSnapshot(featureStore, collected.features);
      state.storeHours = hours;
    } else {
      mergeIncremental(featureStore, collected.features);
    }
    if (shouldAdvanceCursor(collected.meta)) {
      const wm = watermarkFromMeta(collected.meta);
      if (wm != null && Number.isFinite(wm)) state.storeSeq = wm;
      if (collected.meta?.server_time) state.storeSince = collected.meta.server_time;
    }
    publishStore();
    setLivePill(true);
    if (collected.aborted || collected.meta?.truncated) {
      // 未读完：保持旧水位，下一轮继续；同时拉对账以免静默丢页
      scheduleReconcile(0);
    }
  } catch (e) {
    console.warn("refresh failed", e);
    setLivePill(false);
  }
}

async function fetchByIds(ids) {
  const features = [];
  const uniq = [...new Set(ids.map((x) => Number(x)).filter((n) => Number.isFinite(n)))];
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200);
    const url = buildEventsQuery({
      hours: selectedHours(),
      limit: Math.max(chunk.length, 1),
      ids: chunk,
    });
    const fc = await fetchJson(url);
    if (Array.isArray(fc.features)) features.push(...fc.features);
  }
  return features;
}

async function reconcileBody() {
  const hours = selectedHours();
  const r = await apiFetch(`/api/events/reconcile?hours=${encodeURIComponent(hours)}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("reconcile " + r.status);
  const payload = await r.json();
  const prevSeq = state.storeSeq;
  const diff = applyReconcile(featureStore, payload, Number(hours), Date.now());
  if (diff.refetch.length >= 200) {
    await refreshBody({ full: true });
    return;
  }
  if (diff.refetch.length) {
    try {
      const fetched = await fetchByIds(diff.refetch);
      mergeIncremental(featureStore, fetched);
    } catch (err) {
      state.storeSeq = cursorAfterReconcile(prevSeq, {
        refetch: diff.refetch,
        applied: false,
        failed: true,
      });
      throw err;
    }
  }
  state.storeSeq = cursorAfterReconcile(prevSeq, {
    refetch: diff.refetch,
    applied: true,
    failed: false,
    highWater: payload.high_water,
  });
  publishStore();
}

async function reconcileNow() {
  try {
    await runSync(() => reconcileBody());
  } catch (e) {
    console.warn("reconcile failed", e);
  }
}

function scheduleReconcile(delay = 60000) {
  clearTimeout(state.reconcileTimer);
  state.reconcileTimer = setTimeout(() => {
    reconcileNow();
    scheduleReconcile(60000);
  }, delay);
}

function scheduleIncrementalRefresh() {
  clearTimeout(state.incrementalTimer);
  state.incrementalTimer = setTimeout(() => refresh(), 1200);
}

function setLivePill(ok) {
  const el = document.getElementById("livePill");
  if (!el) return;
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
    const dot =
      s.status === "ok"
        ? "ok"
        : s.status === "error"
          ? "err"
          : s.status === "partial"
            ? "err"
            : "off";
    const tail =
      s.status === "ok" || s.status === "error" || s.status === "partial"
        ? fmtAge(s.age_seconds)
        : st[s.status] || s.status;
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
    const r = await apiFetch("/api/health", { cache: "no-store" });
    if (!r.ok) throw new Error("health " + r.status);
    renderHealth(await r.json());
  } catch {
    const tick = document.getElementById("healthTick");
    if (tick) tick.textContent = "更新失败";
  }
}

async function wsTicketQuery() {
  const tok = auth.getToken();
  if (!tok && !auth.allowReconnect()) return "";
  try {
    const r = await apiFetch("/api/ws-ticket", { method: "POST", cache: "no-store" });
    if (r.status === 401) return "";
    if (!r.ok) return "";
    const j = await r.json();
    if (j && j.ticket) return `ticket=${encodeURIComponent(j.ticket)}`;
  } catch {
    /* 无令牌本机直连时 ticket 接口也可能 200 required=false */
  }
  return "";
}

function connectWS() {
  if (!auth.allowReconnect()) return;
  clearTimeout(state.wsReconnectTimer);
  const go = async () => {
    if (!auth.allowReconnect()) return;
    try {
      const q = await wsTicketQuery();
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws${q ? `?${q}` : ""}`,
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
        state.wsBackoffMs = 1000;
        try {
          ws.send("ping");
        } catch {
          /* ignore */
        }
        scheduleReconcile(1500);
      };
      const ping = setInterval(() => {
        if (ws.readyState !== 1) {
          clearInterval(ping);
          return;
        }
        try {
          ws.send("ping");
        } catch {
          /* ignore */
        }
      }, 25000);
      ws.onclose = (ev) => {
        clearInterval(ping);
        const code = ev && ev.code;
        if (code === 4401) {
          auth.noteInvalidCredentials().then((res) => {
            if (res && res.ok) scheduleWsReconnect(300);
          });
          return;
        }
        if (code === 4403) {
          scheduleWsReconnect(300);
          return;
        }
        scheduleWsReconnect(state.wsBackoffMs);
        state.wsBackoffMs = Math.min((state.wsBackoffMs || 1000) * 2, 15000);
      };
    } catch {
      scheduleWsReconnect(state.wsBackoffMs || 5000);
    }
  };
  go();
}

function scheduleWsReconnect(delay) {
  if (!auth.allowReconnect()) return;
  clearTimeout(state.wsReconnectTimer);
  state.wsReconnectTimer = setTimeout(connectWS, delay);
}

export {
  storeToArray,
  mergeIncremental,
  refresh,
  refreshBody,
  scheduleIncrementalRefresh,
  reconcileNow,
  loadHealth,
  loadTheaters,
  connectWS,
  setLivePill,
  renderHealth,
  syncTheaterLayer,
};
