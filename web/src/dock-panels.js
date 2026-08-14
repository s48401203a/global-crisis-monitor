/**
 * 浮动信息框：标题栏拖动；面板贴窗口边缘即收成名称签
 *（不要求指针顶到屏幕边）；左右竖排、上下横排；再点名称签展开。
 */

const STORAGE_KEY = "crisis_panel_docks_v1";
const SNAP_PANEL = 28;
const SNAP_POINTER = 56;
const SNAP_PREVIEW = 56;
const MIN_APPROACH = 22;
const MIN_DRAG = 8;
const EDGE_PAD = 8;
const TAB_GAP = 8;

const SPECS = [
  { id: "stats", sel: ".shell.stats", titleKey: "stTitle", fallback: { zh: "实时统计", en: "Live stats" } },
  { id: "filter", sel: ".shell.left-top", titleKey: "filter", fallback: { zh: "图层筛选", en: "Layers" } },
  { id: "health", sel: ".shell.left-bot", titleKey: "health", fallback: { zh: "数据源健康", en: "Source health" } },
  { id: "feed", sel: ".shell.right", titleKey: "feed", fallback: { zh: "事件流", en: "Event feed" } },
];

let titleResolver = (key, fb) => fb.zh;
let states = {};
let zTop = 22;
let guideEl = null;

function titleOf(spec) {
  try {
    return titleResolver(spec.titleKey, spec.fallback) || spec.fallback.zh;
  } catch {
    return spec.fallback.zh;
  }
}

function topSafe() {
  const bar = document.querySelector(".topbar");
  if (!bar) return 72;
  const bottom = bar.getBoundingClientRect().bottom;
  return Number.isFinite(bottom) ? Math.ceil(bottom) + 8 : 72;
}

function clamp(n, lo, hi) {
  if (hi < lo) return lo;
  return Math.min(Math.max(n, lo), hi);
}

function loadStates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveStates() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    /* ignore quota / private mode */
  }
}

function defaultWidth(spec) {
  if (spec.id === "stats") return Math.min(720, Math.max(280, window.innerWidth - 40));
  if (spec.id === "filter") return 268;
  if (spec.id === "health") return 300;
  return 360;
}

function defaultFeedHeight() {
  return Math.max(180, window.innerHeight - topSafe() - 18);
}

function edgeOf(el) {
  for (const name of ["left", "right", "top", "bottom"]) {
    if (el.classList.contains("dock-" + name)) return name;
  }
  return null;
}

function clearanceOf(rect) {
  return {
    left: rect.left,
    right: window.innerWidth - rect.right,
    top: rect.top,
    bottom: window.innerHeight - rect.bottom,
  };
}

function towardEdge(startRect, rect) {
  const start = clearanceOf(startRect);
  const now = clearanceOf(rect);
  return {
    left: start.left - now.left,
    right: start.right - now.right,
    top: start.top - now.top,
    bottom: start.bottom - now.bottom,
  };
}

function pointerClearance(x, y) {
  return {
    left: x,
    right: window.innerWidth - x,
    top: y,
    bottom: window.innerHeight - y,
  };
}

/**
 * 以面板贴边为主、指针贴边为辅。
 * 必须朝该边移动过一段距离，避免默认就贴边的面板轻挪即收起。
 */
function detectSnap(rect, pointer, startRect, { preview = false } = {}) {
  const panelLimit = preview ? SNAP_PREVIEW : SNAP_PANEL;
  const pointerLimit = preview ? SNAP_POINTER + 20 : SNAP_POINTER;
  const needApproach = preview ? 8 : MIN_APPROACH;
  const panel = clearanceOf(rect);
  const toward = towardEdge(startRect, rect);
  const ptr = pointerClearance(pointer.x, pointer.y);
  let best = null;
  let bestScore = Infinity;
  for (const edge of ["left", "right", "top", "bottom"]) {
    const flushHit = panel[edge] <= EDGE_PAD && toward[edge] >= MIN_DRAG;
    const panelHit = panel[edge] <= panelLimit && toward[edge] >= needApproach;
    const pointerHit = ptr[edge] <= pointerLimit && toward[edge] >= MIN_DRAG;
    if (!flushHit && !panelHit && !pointerHit) continue;
    const score = Math.min(panel[edge], ptr[edge]);
    if (score < bestScore) {
      bestScore = score;
      best = edge;
    }
  }
  return best;
}

function ensureGuide() {
  if (guideEl) return guideEl;
  guideEl = document.createElement("div");
  guideEl.id = "dock-snap-guide";
  guideEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(guideEl);
  return guideEl;
}

function showSnap(edge) {
  const g = ensureGuide();
  g.className = edge ? "is-on edge-" + edge : "";
}

function hideSnap() {
  if (guideEl) guideEl.className = "";
}

function specOf(el) {
  return SPECS.find((s) => el.dataset.dock === s.id || el.matches(s.sel));
}

function ensureChrome(el, spec) {
  el.dataset.dock = spec.id;
  if (!el.querySelector(".dock-tab")) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "dock-tab";
    tab.setAttribute("aria-expanded", "true");
    tab.textContent = titleOf(spec);
    el.insertBefore(tab, el.firstChild);
  }
  const panel = el.querySelector(".panel");
  const hd = el.querySelector(".panel-hd");
  if (hd) {
    hd.classList.add("dock-handle");
  } else if (panel && !el.querySelector(".dock-grip")) {
    const grip = document.createElement("div");
    grip.className = "dock-grip";
    grip.setAttribute("role", "separator");
    grip.setAttribute("aria-orientation", "vertical");
    panel.insertBefore(grip, panel.firstChild);
  }
  syncChromeTitle(el, spec);
}

function syncChromeTitle(el, spec) {
  const name = titleOf(spec);
  const tab = el.querySelector(".dock-tab");
  if (tab) {
    tab.textContent = name;
    tab.title = name;
    tab.setAttribute("aria-label", name);
  }
  const hd = el.querySelector(".panel-hd.dock-handle");
  if (hd) hd.title = name;
  const grip = el.querySelector(".dock-grip");
  if (grip) {
    grip.title = name;
    grip.setAttribute("aria-label", name);
  }
}

function persistSize(el, spec) {
  if (el.classList.contains("is-collapsed")) return;
  const r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 24) return;
  const prev = states[spec.id] || {};
  states[spec.id] = {
    ...prev,
    w: Math.round(r.width),
    h: Math.round(r.height),
    restoreX: Math.round(r.left),
    restoreY: Math.round(r.top),
  };
}

function persist(el, spec, extra = {}) {
  const r = el.getBoundingClientRect();
  const collapsed = extra.collapsed ?? el.classList.contains("is-collapsed");
  const prev = states[spec.id] || {};
  const next = {
    ...prev,
    collapsed,
    edge: extra.edge ?? (collapsed ? edgeOf(el) : prev.edge || null),
    x: Math.round(r.left),
    y: Math.round(r.top),
  };
  if (!collapsed && r.width >= 40 && r.height >= 24) {
    next.w = Math.round(r.width);
    next.h = Math.round(r.height);
  }
  states[spec.id] = next;
  saveStates();
}

function clearDockSides(el) {
  el.classList.remove("dock-left", "dock-right", "dock-top", "dock-bottom");
}

function liftToFree(el, spec, rect) {
  el.classList.add("is-ready", "is-free");
  el.style.left = rect.left + "px";
  el.style.top = rect.top + "px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.transform = "none";
  el.style.animation = "none";
  el.style.zIndex = String(++zTop);
  if (!el.classList.contains("is-collapsed")) {
    el.style.width = rect.width + "px";
    if (spec.id === "feed") el.style.height = rect.height + "px";
    else el.style.height = "auto";
  }
}

function clampIntoView(el) {
  const r = el.getBoundingClientRect();
  const maxL = Math.max(EDGE_PAD, window.innerWidth - r.width - EDGE_PAD);
  const maxT = Math.max(EDGE_PAD, window.innerHeight - r.height - EDGE_PAD);
  const left = clamp(r.left, EDGE_PAD, maxL);
  const top = clamp(r.top, EDGE_PAD, maxT);
  el.style.left = left + "px";
  el.style.top = top + "px";
}

function packEdge(edge) {
  const shells = [...document.querySelectorAll(".shell.is-collapsed.dock-" + edge)];
  if (!shells.length) return;
  const vertical = edge === "left" || edge === "right";
  shells.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return vertical ? ra.top - rb.top : ra.left - rb.left;
  });
  const minStart = vertical ? topSafe() : EDGE_PAD;
  const maxEnd = vertical ? window.innerHeight - EDGE_PAD : window.innerWidth - EDGE_PAD;
  let cursor = minStart;
  for (const el of shells) {
    const r = el.getBoundingClientRect();
    const size = vertical ? r.height : r.width;
    let pos = vertical ? r.top : r.left;
    if (pos < cursor) pos = cursor;
    if (pos + size > maxEnd) pos = Math.max(minStart, maxEnd - size);
    if (vertical) {
      el.style.top = pos + "px";
      el.style.left =
        edge === "left" ? EDGE_PAD + "px" : window.innerWidth - r.width - EDGE_PAD + "px";
    } else {
      el.style.left = pos + "px";
      el.style.top =
        edge === "top" ? topSafe() + "px" : window.innerHeight - r.height - EDGE_PAD + "px";
    }
    cursor = pos + size + TAB_GAP;
    const spec = specOf(el);
    if (spec) persist(el, spec, { collapsed: true, edge });
  }
}

function applyCollapsed(el, spec, edge, along) {
  el.classList.add("is-ready", "is-free", "is-collapsed");
  el.classList.remove("is-dragging");
  clearDockSides(el);
  el.classList.add("dock-" + edge);
  el.style.width = "max-content";
  el.style.height = "max-content";
  el.style.maxWidth = "none";
  el.style.maxHeight = "none";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.transform = "none";
  el.style.animation = "none";
  el.style.zIndex = String(++zTop);
  const tab = el.querySelector(".dock-tab");
  if (tab) tab.setAttribute("aria-expanded", "false");
  syncChromeTitle(el, spec);

  const place = () => {
    const r = el.getBoundingClientRect();
    if (edge === "left" || edge === "right") {
      const top = clamp(along ?? r.top, topSafe(), window.innerHeight - r.height - EDGE_PAD);
      el.style.top = top + "px";
      el.style.left =
        edge === "left" ? EDGE_PAD + "px" : window.innerWidth - r.width - EDGE_PAD + "px";
    } else {
      const left = clamp(along ?? r.left, EDGE_PAD, window.innerWidth - r.width - EDGE_PAD);
      el.style.left = left + "px";
      el.style.top =
        edge === "top" ? topSafe() + "px" : window.innerHeight - r.height - EDGE_PAD + "px";
    }
    persist(el, spec, { collapsed: true, edge });
    packEdge(edge);
  };
  requestAnimationFrame(place);
}

function applyFloating(el, spec, st) {
  el.classList.add("is-ready", "is-free");
  el.classList.remove("is-collapsed", "is-dragging");
  clearDockSides(el);
  el.style.animation = "none";
  el.style.transform = "none";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = (st.w || defaultWidth(spec)) + "px";
  if (spec.id === "feed") el.style.height = (st.h || defaultFeedHeight()) + "px";
  else el.style.height = "auto";
  const tab = el.querySelector(".dock-tab");
  if (tab) tab.setAttribute("aria-expanded", "true");
  el.style.left = (st.x ?? EDGE_PAD) + "px";
  el.style.top = (st.y ?? topSafe()) + "px";
  clampIntoView(el);
}

function expandPanel(el, spec) {
  const st = states[spec.id] || {};
  const edge = edgeOf(el) || st.edge;
  const tabRect = el.getBoundingClientRect();
  el.classList.remove("is-collapsed");
  clearDockSides(el);
  el.classList.add("is-ready", "is-free");
  const tab = el.querySelector(".dock-tab");
  if (tab) tab.setAttribute("aria-expanded", "true");

  const w = st.w || defaultWidth(spec);
  el.style.width = w + "px";
  if (spec.id === "feed") {
    const h = Math.min(st.h || defaultFeedHeight(), window.innerHeight - topSafe() - EDGE_PAD);
    el.style.height = h + "px";
  } else {
    el.style.height = "auto";
  }
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.transform = "none";

  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    const maxL = Math.max(EDGE_PAD, window.innerWidth - r.width - EDGE_PAD);
    const maxT = Math.max(EDGE_PAD, window.innerHeight - r.height - EDGE_PAD);
    let left;
    let top;
    if (Number.isFinite(st.restoreX) && Number.isFinite(st.restoreY)) {
      left = clamp(st.restoreX, EDGE_PAD, maxL);
      top = clamp(st.restoreY, EDGE_PAD, maxT);
    } else if (edge === "right") {
      left = window.innerWidth - r.width - EDGE_PAD;
      top = clamp(st.y ?? tabRect.top, topSafe(), maxT);
    } else if (edge === "left") {
      left = EDGE_PAD;
      top = clamp(st.y ?? tabRect.top, topSafe(), maxT);
    } else if (edge === "top") {
      top = topSafe();
      left = clamp(st.x ?? tabRect.left, EDGE_PAD, maxL);
    } else if (edge === "bottom") {
      top = window.innerHeight - r.height - EDGE_PAD;
      left = clamp(st.x ?? tabRect.left, EDGE_PAD, maxL);
    } else {
      left = clamp(st.x ?? tabRect.left, EDGE_PAD, maxL);
      top = clamp(st.y ?? tabRect.top, topSafe(), maxT);
    }
    el.style.left = left + "px";
    el.style.top = top + "px";
    persist(el, spec, { collapsed: false, edge: edge || null });
  });
}

function bindDrag(el, spec) {
  if (el.dataset.dockBound === "1") return;
  el.dataset.dockBound = "1";

  const onDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest("input, select, textarea, a, label.chk, button:not(.dock-tab)")) return;
    const handle = e.target.closest(".dock-handle, .dock-grip, .dock-tab");
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const offX = startX - rect.left;
    const offY = startY - rect.top;
    const wasCollapsed = el.classList.contains("is-collapsed");
    let dragging = false;
    let liveSnapped = false;

    const stopListen = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      hideSnap();
      document.body.classList.remove("is-dock-dragging");
      el.classList.remove("is-dragging");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const collapseNow = (ev, edge) => {
      liveSnapped = true;
      stopListen();
      const along = edge === "left" || edge === "right" ? ev.clientY - 28 : ev.clientX - 36;
      applyCollapsed(el, spec, edge, along);
    };

    const startDrag = () => {
      dragging = true;
      document.body.classList.add("is-dock-dragging");
      if (!wasCollapsed) persistSize(el, spec);
      el.classList.add("is-dragging");
      liftToFree(el, spec, rect);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture optional */
      }
    };

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) >= MIN_DRAG) startDrag();
      if (!dragging || liveSnapped) return;
      el.style.left = ev.clientX - offX + "px";
      el.style.top = ev.clientY - offY + "px";
      const nowRect = {
        left: ev.clientX - offX,
        right: ev.clientX - offX + rect.width,
        top: ev.clientY - offY,
        bottom: ev.clientY - offY + rect.height,
        width: rect.width,
        height: rect.height,
      };
      const pointer = { x: ev.clientX, y: ev.clientY };
      showSnap(detectSnap(nowRect, pointer, rect, { preview: true }));
      if (wasCollapsed) return;
      const edge = detectSnap(nowRect, pointer, rect);
      if (edge) collapseNow(ev, edge);
    };

    const finish = (ev) => {
      if (liveSnapped) return;
      stopListen();
      const travel = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (wasCollapsed && travel < 16) {
        expandPanel(el, spec);
        return;
      }
      if (!dragging) return;
      const nowRect = el.getBoundingClientRect();
      const pointer = { x: ev.clientX, y: ev.clientY };
      const edge = detectSnap(nowRect, pointer, rect);
      if (edge) {
        collapseNow(ev, edge);
        return;
      }
      if (wasCollapsed) {
        expandPanel(el, spec);
        return;
      }
      clampIntoView(el);
      persist(el, spec, { collapsed: false });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  el.addEventListener("pointerdown", onDown);
}

function restoreOrReady(el, spec) {
  const st = states[spec.id];
  if (st && (st.collapsed || Number.isFinite(st.x))) {
    el.style.animation = "none";
    el.style.opacity = "1";
    if (st.collapsed && st.edge) {
      const along = st.edge === "left" || st.edge === "right" ? st.y : st.x;
      applyCollapsed(el, spec, st.edge, along);
    } else applyFloating(el, spec, st);
    return;
  }
  const mark = () => el.classList.add("is-ready");
  el.addEventListener("animationend", mark, { once: true });
  window.setTimeout(mark, 1200);
}

function pinUnmovedBelowTopbar() {
  const top = topSafe();
  for (const spec of SPECS) {
    if (spec.id === "health") continue;
    const el = document.querySelector(spec.sel);
    if (!el || el.classList.contains("is-free") || el.classList.contains("is-collapsed")) continue;
    el.style.top = top + "px";
  }
}

function onResize() {
  pinUnmovedBelowTopbar();
  for (const spec of SPECS) {
    const el = document.querySelector(spec.sel);
    if (!el || !el.classList.contains("is-free")) continue;
    if (el.classList.contains("is-collapsed")) {
      const edge = edgeOf(el);
      if (!edge) continue;
      const along =
        edge === "left" || edge === "right"
          ? parseFloat(el.style.top) || 0
          : parseFloat(el.style.left) || 0;
      applyCollapsed(el, spec, edge, along);
    } else {
      clampIntoView(el);
    }
  }
}

export function refreshDockTitles() {
  for (const spec of SPECS) {
    const el = document.querySelector(spec.sel);
    if (el) syncChromeTitle(el, spec);
  }
}

export function visibleShellInsets() {
  let left = 16;
  let right = 16;
  let bottom = 24;
  let top = 0;
  document.querySelectorAll(".shell").forEach((el) => {
    if (!el || !el.getClientRects().length) return;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const midX = r.left + r.width / 2;
    const midY = r.top + r.height / 2;
    if (midX < window.innerWidth * 0.42) left = Math.max(left, Math.ceil(r.right) + 8);
    if (midX > window.innerWidth * 0.58) right = Math.max(right, Math.ceil(window.innerWidth - r.left) + 8);
    if (midY > window.innerHeight * 0.78) bottom = Math.max(bottom, Math.ceil(window.innerHeight - r.top) + 8);
    if (midY < window.innerHeight * 0.22) top = Math.max(top, Math.ceil(r.bottom) + 8);
  });
  return { left, right, bottom, top };
}

export function initDockablePanels(opts = {}) {
  if (typeof opts.getTitle === "function") titleResolver = opts.getTitle;
  states = loadStates();
  for (const spec of SPECS) {
    const el = document.querySelector(spec.sel);
    if (!el) continue;
    ensureChrome(el, spec);
    restoreOrReady(el, spec);
    bindDrag(el, spec);
  }
  window.removeEventListener("resize", onResize);
  window.addEventListener("resize", onResize);
  refreshDockTitles();
  pinUnmovedBelowTopbar();
  window.setTimeout(pinUnmovedBelowTopbar, 200);
  window.setTimeout(pinUnmovedBelowTopbar, 1100);
  requestAnimationFrame(() => {
    for (const edge of ["left", "right", "top", "bottom"]) packEdge(edge);
  });
}
