/** 突发事件：判定、闪烁态、队列与自动飞行停留。 */
import {
  BLINK_DURATION_MS,
  BREAKING_BLINK_MS,
  LIVE_WINDOW_MS,
  STARTUP_BREAKING_MS,
  blinkStartedAt,
  breakingBlinkUntil,
  breakingQueue,
  breakingQueued,
  seenEventIds,
} from "./constants.js";
import { cmaSignalLevel, isMinorCmaAlert, parseMetrics } from "./grade.js";
import { L } from "./i18n/index.js";
import { showToast } from "./panels/index.js";
import { applyFeatures, inLocal } from "./pipeline.js";
import { showEventPopup } from "./popup/index.js";
import { state } from "./state.js";
import { flyPromise, highlightTourItem, zoomForEvent } from "./tour/index.js";
import { eventHeadline } from "./headline.js";

function eventNewestMs(p) {
  const occ = p?.occurred_at ? new Date(p.occurred_at).getTime() : NaN;
  const seen = p?.first_seen_at ? new Date(p.first_seen_at).getTime() : NaN;
  const candidates = [occ, seen].filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : NaN;
}

function isBreakingAlert(f) {
  const p = (f && f.properties) || f || {};
  if (isMinorCmaAlert(p)) return false;
  if (p.type === "war") return false;
  if (p.status === "closed") return false;
  if (p.is_aggregate || parseMetrics(p).aggregate) return false;
  const coords = f && f.geometry && f.geometry.coordinates;
  const lon = coords ? Number(coords[0]) : Number(p._lon);
  const lat = coords ? Number(coords[1]) : Number(p._lat);
  const mag = Number(p.magnitude);
  const sev = Number(p.severity) || 0;
  const t = p.type;
  if (t === "earthquake") {
    const local = Number.isFinite(lon) && Number.isFinite(lat) && inLocal(lon, lat);
    if (local && Number.isFinite(mag) && mag >= 4.0) return true;
    return Number.isFinite(mag) && mag >= 4.5;
  }
  if (t === "rainstorm" || t === "flood" || t === "cyclone" || t === "volcano") return true;
  if (t === "wildfire") return sev >= 0.45;
  if (t === "armed_clash" || t === "crisis_signal") {
    const c = Number(p.confidence);
    return !Number.isFinite(c) || c >= 0.7;
  }
  return sev >= 0.75;
}

/**
 * 是否闪烁：新灾害强制闪；其余仅近时且够格的事件闪一阵。
 */
function isLiveEvent(p) {
  if (!p) return false;
  const now = Date.now();
  const bid = String(p.id);
  const until = breakingBlinkUntil.get(bid);
  if (until) {
    if (now < until) return true;
    breakingBlinkUntil.delete(bid);
  }
  if (!isBreakingAlert(p)) {
    blinkStartedAt.delete(p.id);
    return false;
  }
  const ref = eventNewestMs(p);
  if (!Number.isFinite(ref)) return false;
  const age = now - ref;
  if (age < 0 || age > LIVE_WINDOW_MS) {
    blinkStartedAt.delete(p.id);
    return false;
  }
  if (!blinkStartedAt.has(p.id)) blinkStartedAt.set(p.id, now);
  return now - blinkStartedAt.get(p.id) < BLINK_DURATION_MS;
}

function markBreakingBlink(id) {
  if (id == null) return;
  breakingBlinkUntil.set(String(id), Date.now() + BREAKING_BLINK_MS);
}

function enqueueBreakingAlerts(feats) {
  state.breakingCruisePaused = false;
  for (const f of feats || []) {
    if (!f || !f.properties || !f.geometry || !f.geometry.coordinates) continue;
    const id = String(f.properties.id);
    if (breakingQueued.has(id)) continue;
    if (state.tourActiveId != null && String(state.tourActiveId) === id) continue;
    breakingQueued.add(id);
    breakingQueue.push(f);
    markBreakingBlink(id);
  }
  breakingQueue.sort(
    (a, b) => (Number(b.properties.severity) || 0) - (Number(a.properties.severity) || 0),
  );
  if (!state.applyingFeatures && state.lastFeatures.length) applyFeatures(state.lastFeatures);
  else pumpBreakingQueue();
}

function pumpBreakingQueue() {
  if (state.breakingAlertBusy || state.tourFlying || state.breakingCruisePaused) return;
  if (typeof document !== "undefined" && document.hidden) return;
  const f = breakingQueue.shift();
  if (!f) return;
  breakingQueued.delete(String(f.properties.id));
  focusBreakingEvent(f);
}

function breakingDwellMs(p) {
  if (!p || p.category === "conflict") return 8000;
  const mag = Number(p.magnitude);
  if (p.type === "earthquake" && Number.isFinite(mag)) {
    if (mag >= 7) return 60000;
    if (mag >= 5) return 30000;
    return 10000;
  }
  const lv = cmaSignalLevel(p);
  if (lv === "红") return 60000;
  if (lv === "橙") return 30000;
  const sev = Number(p.severity) || 0;
  if (sev >= 0.8) return 60000;
  if (sev >= 0.55) return 30000;
  return 10000;
}

function cancelBreakingDwell() {
  if (typeof state.breakingDwellCancel === "function") {
    state.breakingDwellCancel();
    state.breakingDwellCancel = null;
  }
}

function waitBreakingDwell(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      if (state.breakingDwellCancel === done) state.breakingDwellCancel = null;
      clearTimeout(t);
      resolve();
    }
    state.breakingDwellCancel = done;
  });
}

async function focusBreakingEvent(f) {
  if (!f || !state.mapReady) return;
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties;
  state.breakingAlertBusy = true;
  state.breakingCruisePaused = false;
  highlightTourItem(p.id);
  showToast(L().newAlert, eventHeadline(p));
  try {
    await flyPromise({
      center: [lon, lat],
      zoom: zoomForEvent(f),
      duration: 1400,
      curve: 1.28,
      essential: true,
    });
    if (state.mapReady) showEventPopup(p, [lon, lat], { fromBreaking: true });
    const dwell = breakingDwellMs(p);
    if (dwell > 0 && !state.breakingCruisePaused) await waitBreakingDwell(dwell);
  } finally {
    state.breakingAlertBusy = false;
    if (!state.breakingCruisePaused) pumpBreakingQueue();
  }
}

function detectAndQueueBreaking(feats) {
  const list = (feats || []).filter(
    (f) => f && f.properties && f.geometry && f.geometry.coordinates,
  );
  if (!seenEventIds.size) {
    for (const f of list) seenEventIds.add(String(f.properties.id));
    const now = Date.now();
    const recent = list
      .filter((f) => isBreakingAlert(f))
      .filter((f) => {
        const ts = eventNewestMs(f.properties);
        return Number.isFinite(ts) && now - ts <= STARTUP_BREAKING_MS;
      })
      .sort((a, b) => eventNewestMs(b.properties) - eventNewestMs(a.properties));
    if (recent[0]) enqueueBreakingAlerts([recent[0]]);
    return;
  }
  const fresh = [];
  for (const f of list) {
    const id = String(f.properties.id);
    if (seenEventIds.has(id)) continue;
    seenEventIds.add(id);
    if (isBreakingAlert(f)) fresh.push(f);
  }
  if (fresh.length) enqueueBreakingAlerts(fresh);
}

export {
  isBreakingAlert,
  isLiveEvent,
  markBreakingBlink,
  enqueueBreakingAlerts,
  pumpBreakingQueue,
  breakingDwellMs,
  cancelBreakingDwell,
  waitBreakingDwell,
  focusBreakingEvent,
  detectAndQueueBreaking,
  eventNewestMs,
};
