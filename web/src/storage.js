/**
 * localStorage 单键版本化：所有 UI 偏好存于 crisis.v3 一个 JSON；
 * 结构变化时提升 VERSION，旧值整体丢弃（避免半兼容导致面板错位）。
 * 首次运行时从旧散键迁移一次。
 */
const KEY = "crisis.v3";
const VERSION = 3;
const LEGACY = {
  lang: "crisis_ui_lang",
  panelsCollapsed: "crisis_panels_collapsed",
  typeFilters: "crisis_type_filters",
  docks: "crisis_panel_docks_v2",
};

let cache = null;

function load() {
  if (cache) return cache;
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!data || data.v !== VERSION || typeof data !== "object") {
    data = { v: VERSION };
    // 一次性迁移旧散键
    try {
      const lang = localStorage.getItem(LEGACY.lang);
      if (lang === "zh" || lang === "en") data.lang = lang;
      const pc = localStorage.getItem(LEGACY.panelsCollapsed);
      if (pc === "true") data.panelsCollapsed = true;
      const tf = localStorage.getItem(LEGACY.typeFilters);
      if (tf) data.typeFilters = JSON.parse(tf);
      const dk = localStorage.getItem(LEGACY.docks);
      if (dk) data.docks = JSON.parse(dk);
      for (const k of Object.values(LEGACY)) localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
    persist(data);
  }
  cache = data;
  return cache;
}

function persist(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function getPref(name, fallback = undefined) {
  const d = load();
  return d[name] === undefined ? fallback : d[name];
}

export function setPref(name, value) {
  const d = load();
  d[name] = value;
  persist(d);
}

export const STORAGE_KEY = KEY;
