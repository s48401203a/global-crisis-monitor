import "./styles.css";

/* ========== 界面语言：中文 / English（联动地图地名） ========== */
let uiLang = (() => {
  try {
    const s = localStorage.getItem("crisis_ui_lang");
    if (s === "en" || s === "zh") return s;
  } catch (_) {}
  return "zh";
})();

const ZH = {
  types: {
    earthquake: "地震",
    cyclone: "气旋/台风",
    flood: "洪水",
    wildfire: "野火",
    volcano: "火山",
    drought: "干旱",
    armed_clash: "武装冲突",
    crisis_signal: "危机信号",
    war: "战争冲突",
  },
  cats: { natural: "自然灾害", conflict: "战争/冲突" },
  sources: {
    usgs: "美国地质调查局",
    emsc: "欧洲地中海地震中心",
    gdacs: "全球灾害警报协调系统",
    eonet: "NASA 地球观测事件",
    gdelt: "全球事件数据库",
    war: "战争冲突热点",
    openmeteo: "Open-Meteo 洪水",
    firms: "NASA 火点 FIRMS",
  },
  status: { ok: "正常", error: "异常" },
  units: {
    M: "震级",
    kts: "节",
    acres: "英亩",
    "m3/s": "立方米/秒",
    articles: "篇报道",
    K: "亮温",
  },
  never: "从未成功",
  justNow: "刚刚",
  minutesAgo: (n) => `${n} 分钟前`,
  hoursAgo: (n) => `${n} 小时前`,
  viewGlobal: "当前为全球总览。切换「本地专题」将聚焦中国区域并优先展示本地相关事件。",
  viewLocal: "当前为本地专题（中国区域）。列表优先显示落在本地范围内的事件，地图已自动缩放。",
  unknown: "未知",
  unknownRegion: "未知区域",
  live: "实时运行",
  connErr: "连接异常",
  healthFail: "更新失败",
  syncing: "同步中",
  noSource: "暂无数据源状态",
  loadingSource: "正在连接数据源…",
  loadingEvents: "正在加载事件…",
  emptyEvents: "当前筛选下暂无事件",
  items: (n) => `${n} 条`,
  latest: "最新优先",
  liveCount: (n) => `${n} 条进行中`,
  mapFlat: "已切换：平面地图",
  mapGlobe: "已切换：悬浮地球仪",
  mapFlatFast: "已切换：平面地图（快速）",
  mapGlobeFast: "已切换：地球仪（快速）",
  mapFail: "切换失败，已恢复原形态",
  surfaceSat: "已切换：卫星影像",
  surfaceTopo: "已切换：地形地貌",
  mapForm: "地图形态",
  surface: "地表材质",
  langSwitched: "界面与地图地名已切换为中文",
  newAlert: "新告警",
  alertPush: "收到新事件推送",
};

const EN = {
  types: {
    earthquake: "Earthquake",
    cyclone: "Cyclone/Typhoon",
    flood: "Flood",
    wildfire: "Wildfire",
    volcano: "Volcano",
    drought: "Drought",
    armed_clash: "Armed clash",
    crisis_signal: "Crisis signal",
    war: "War / Conflict",
  },
  cats: { natural: "Natural hazards", conflict: "War / Conflict" },
  sources: {
    usgs: "USGS",
    emsc: "EMSC",
    gdacs: "GDACS",
    eonet: "NASA EONET",
    gdelt: "GDELT",
    war: "War hotspots",
    openmeteo: "Open-Meteo flood",
    firms: "NASA FIRMS",
  },
  status: { ok: "OK", error: "Error" },
  units: {
    M: "magnitude",
    kts: "kts",
    acres: "acres",
    "m3/s": "m³/s",
    articles: "articles",
    K: "K",
  },
  never: "Never",
  justNow: "Just now",
  minutesAgo: (n) => `${n} min ago`,
  hoursAgo: (n) => `${n} h ago`,
  viewGlobal:
    "Global overview. Switch to Local to focus on China and prioritize regional events.",
  viewLocal:
    "Local mode (China region). List prioritizes events inside the local area; map is zoomed in.",
  unknown: "Unknown",
  unknownRegion: "Unknown region",
  live: "Live",
  connErr: "Connection error",
  healthFail: "Update failed",
  syncing: "Syncing",
  noSource: "No source status",
  loadingSource: "Connecting sources…",
  loadingEvents: "Loading events…",
  emptyEvents: "No events under current filters",
  items: (n) => `${n}`,
  latest: "Newest first",
  liveCount: (n) => `${n} live`,
  mapFlat: "Switched to flat map",
  mapGlobe: "Switched to globe",
  mapFlatFast: "Switched to flat map (quick)",
  mapGlobeFast: "Switched to globe (quick)",
  mapFail: "Switch failed; restored previous mode",
  surfaceSat: "Switched to satellite imagery",
  surfaceTopo: "Switched to terrain",
  mapForm: "Map mode",
  surface: "Surface",
  langSwitched: "UI and map labels switched to English",
  newAlert: "New alert",
  alertPush: "New event push received",
};

function L() {
  return uiLang === "en" ? EN : ZH;
}

/** 静态 DOM 文案（data-i18n） */
const UI_I18N = {
  zh: {
    title: "全球综合危机监测中心",
    brandSub: "公开数据 · 本地部署",
    live: "实时运行",
    global: "全球总览",
    local: "本地专题",
    flat: "平面图",
    globe: "地球仪",
    sat: "卫星",
    topo: "地形",
    stTotal: "事件总数",
    stNat: "自然灾害",
    stCon: "战争/冲突",
    stHi: "高严重度",
    filter: "图层筛选",
    cat: "事件类别",
    labNat: "自然灾害",
    labCon: "战争/冲突",
    hours: "时间窗口",
    h24: "近 24 小时",
    h72: "近 3 天",
    h168: "近 7 天",
    legend: "类型配色",
    typeFilter: "类型图层",
    typesAll: "全选",
    typesNone: "全不选",
    typesInvert: "反选",
    eqLt5: "地震<5",
    eqGe5: "≥5",
    eqGe7: "≥7",
    blink: "近 1 小时内事件闪烁 1 分钟（保持类型色）后恢复静态",
    health: "数据源健康",
    feed: "事件流",
    panelsHide: "收起面板",
    panelsShow: "展开面板",
    panelsHideTitle: "收起浮动信息面板",
    panelsShowTitle: "展开浮动信息面板",
    tourHint:
      "空格 按时间巡览 · 点击地图/列表锁定国家区域 · Esc 退出并恢复全局时间序",
    disclaimer:
      "本系统为公开信息聚合演示，不可替代官方应急预警 · 冲突数据存在媒体偏差与延迟",
    flatTitle: "平面墨卡托地图",
    globeTitle: "悬浮立体地球仪",
    satTitle: "卫星影像地表",
    topoTitle: "地形地貌地表",
  },
  en: {
    title: "Global Crisis Monitor",
    brandSub: "Open data · Local deploy",
    live: "Live",
    global: "Global",
    local: "Local",
    flat: "Flat",
    globe: "Globe",
    sat: "Satellite",
    topo: "Terrain",
    stTotal: "Total events",
    stNat: "Natural hazards",
    stCon: "War / Conflict",
    stHi: "High severity",
    filter: "Layers",
    cat: "Category",
    labNat: "Natural hazards",
    labCon: "War / Conflict",
    hours: "Time window",
    h24: "Last 24 hours",
    h72: "Last 3 days",
    h168: "Last 7 days",
    legend: "Type colors",
    typeFilter: "Type layers",
    typesAll: "All",
    typesNone: "None",
    typesInvert: "Invert",
    eqLt5: "EQ <5",
    eqGe5: "≥5",
    eqGe7: "≥7",
    blink: "Events from the last hour blink for 1 minute, then stay static",
    health: "Source health",
    feed: "Event feed",
    panelsHide: "Hide panels",
    panelsShow: "Show panels",
    panelsHideTitle: "Hide floating information panels",
    panelsShowTitle: "Show floating information panels",
    tourHint:
      "Space: tour by time · Click map/list to lock a country · Esc: exit tour",
    disclaimer:
      "Demo of open-source aggregation — not official emergency alerts. Conflict data may be biased or delayed.",
    flatTitle: "Flat Mercator map",
    globeTitle: "Floating 3D globe",
    satTitle: "Satellite imagery",
    topoTitle: "Topographic surface",
  },
};

const LOCAL_BOUNDS = [
  [73, 18],
  [135, 54],
]; // 中国大致范围
const LOCAL_CENTER = [104.5, 35.0];
let currentView = "global";
let lastFeatures = [];
let mapReady = false;
let panelsCollapsed = (() => {
  try {
    return localStorage.getItem("crisis_panels_collapsed") === "true";
  } catch (_) {
    return false;
  }
})();

/* 空格键巡览：逐个飞入灾害点 → 弹窗 → 再按空格切下一项 */
let tourList = []; // 当前筛选下可巡览的点要素
let tourIndex = -1; // -1 表示尚未开始
let tourFlying = false;
let tourPopup = null;
let tourActiveId = null;
let tourMode = false; // 是否处于空格预览模式
/** 巡览范围：time=全局按时间；region=锁定国家/就近区域按时间 */
let tourScope = "time";
/** 区域焦点 { country, lon, lat, name, radiusKm } */
let tourFocus = null;
/** 最近一次 enrich 后的点要素缓存，供区域巡览重建 */
let lastEnrichedPoints = [];

/* 地图形态：平面 / 地球仪；地表材质：卫星 / 地形 */
let mapMode = "flat"; // flat | globe
let surfaceMode = "sat"; // sat | topo

/**
 * 类型配色（地图点 / 列表 / 图例统一）
 * 地震默认中性琥珀；≥5 黄、≥7 红由 mapMarkerColor 覆盖
 */
const TYPE_COLORS = {
  earthquake: "#c9a227", // 默认琥珀金 · 小震
  cyclone: "#5b8def", // 天蓝 · 气旋
  flood: "#2bb0ed", // 亮青蓝 · 洪水
  wildfire: "#ff5c33", // 焰橙 · 野火
  volcano: "#d946ef", // 品红 · 火山
  drought: "#a78b4a", // 枯沙 · 干旱
  crisis_signal: "#f472b6", // 粉红 · 危机信号
  armed_clash: "#ef4444", // 正红 · 武装冲突
  war: "#b91c1c", // 暗红 · 战争冲突
};
const TYPE_COLOR_DEFAULT = "#94a3b8";
const EQ_COLOR_M5 = "#f0b429"; // 震级≥5 黄
const EQ_COLOR_M7 = "#e11d48"; // 震级≥7 红

/** 可筛选类型（与图例/地图点一致） */
const FILTERABLE_TYPES = [
  { type: "earthquake", category: "natural" },
  { type: "cyclone", category: "natural" },
  { type: "flood", category: "natural" },
  { type: "wildfire", category: "natural" },
  { type: "volcano", category: "natural" },
  { type: "drought", category: "natural" },
  { type: "war", category: "conflict" },
  { type: "armed_clash", category: "conflict" },
  { type: "crisis_signal", category: "conflict" },
];

/** 类型开关：默认全开；localStorage 持久化 */
let typeFilterEnabled = (() => {
  const allOn = {};
  for (const it of FILTERABLE_TYPES) allOn[it.type] = true;
  try {
    const raw = localStorage.getItem("crisis_type_filters");
    if (!raw) return allOn;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return allOn;
    for (const it of FILTERABLE_TYPES) {
      if (typeof saved[it.type] === "boolean") allOn[it.type] = saved[it.type];
    }
    return allOn;
  } catch (_) {
    return allOn;
  }
})();

function persistTypeFilters() {
  try {
    localStorage.setItem("crisis_type_filters", JSON.stringify(typeFilterEnabled));
  } catch (_) {}
}

function isTypeEnabled(t) {
  if (!t) return true;
  if (Object.prototype.hasOwnProperty.call(typeFilterEnabled, t)) {
    return typeFilterEnabled[t] !== false;
  }
  // 未知类型：跟所属大类走，默认显示
  return true;
}

function setTypeFilter(type, on, { apply = true } = {}) {
  if (!Object.prototype.hasOwnProperty.call(typeFilterEnabled, type)) return;
  typeFilterEnabled[type] = Boolean(on);
  persistTypeFilters();
  const input = document.getElementById(`f-type-${type}`);
  if (input) input.checked = typeFilterEnabled[type];
  if (apply && lastFeatures.length) applyFeatures(lastFeatures);
}

function setAllTypeFilters(on, { category = null } = {}) {
  for (const it of FILTERABLE_TYPES) {
    if (category && it.category !== category) continue;
    typeFilterEnabled[it.type] = Boolean(on);
  }
  persistTypeFilters();
  renderTypeLegend();
  if (lastFeatures.length) applyFeatures(lastFeatures);
}

/** 反选：逐类型翻转开关状态 */
function setInvertTypeFilters() {
  for (const it of FILTERABLE_TYPES) {
    typeFilterEnabled[it.type] = !typeFilterEnabled[it.type];
  }
  persistTypeFilters();
  renderTypeLegend();
  if (lastFeatures.length) applyFeatures(lastFeatures);
}

/** 仅近 1 小时内的事件可闪烁；首次进入闪烁后连续 1 分钟，超时恢复静态 */
const LIVE_WINDOW_MS = 60 * 60 * 1000; // 近 1 小时
const BLINK_DURATION_MS = 60 * 1000; // 连续闪烁 1 分钟
/** eventId -> 本页开始闪烁的时间戳 */
const blinkStartedAt = new Map();

/** 地图标记色 = 列表/等级色（地震按震级，其它按类型） */
function mapMarkerColor(p) {
  if (!p) return TYPE_COLOR_DEFAULT;
  if (p.type === "earthquake") return typeTextColor(p);
  return typeColor(p.type);
}

/* ========== 简报 / 影响范围 / 路径几何 ========== */

/** 震级 → 有感影响半径（km，经验估算，非官方烈度圈） */
function eqImpactRadiusKm(mag) {
  const m = Number(mag);
  if (!Number.isFinite(m) || m < 2) return 12;
  // 约：M4≈40km, M5≈90km, M6≈200km, M7≈420km, M8≈850km
  return Math.min(900, Math.round(Math.pow(10, 0.48 * m - 0.55)));
}

function makeCirclePolygon(lon, lat, radiusKm, steps = 64) {
  const coords = [];
  const R = 6371;
  const angDist = radiusKm / R;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
        Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
      );
    coords.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

function destPoint(lon, lat, bearingDeg, distKm) {
  const R = 6371;
  const brng = (bearingDeg * Math.PI) / 180;
  const angDist = distKm / R;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) + Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/** 经纬度一句话格式（南北纬/东西经） */
function fmtCoord(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "坐标待定";
  const ns = la >= 0 ? `${la.toFixed(2)}°N` : `${Math.abs(la).toFixed(2)}°S`;
  const ew = lo >= 0 ? `${lo.toFixed(2)}°E` : `${Math.abs(lo).toFixed(2)}°W`;
  return `${ns}, ${ew}`;
}

/** 洪水/泥石流示意方向（无真实方位时用确定性伪方向，保证稳定） */
function floodBearingDeg(p) {
  const id = Number(p.id) || 0;
  // 0–360 稳定哈希，避免随机跳动
  return (id * 47 + Math.round((Number(p.magnitude) || 0) * 13)) % 360;
}

/** 当前聚焦事件 id（用于特效层 focused 标记） */
let effectsFocusId = null;
/** 地震波扩散动效临时环（叠加在 effects 源上） */
let _eqWaveExtras = [];

/**
 * 一句话简报（弹窗/空格预览/列表共用；跟随界面语言）
 */
function buildBrief(p) {
  const t = p.type;
  const place = countryLabel(p.country);
  const when = fmtTime(p.occurred_at);
  const grade = realGrade(p);
  const mag = p.magnitude != null && p.magnitude !== "null" ? Number(p.magnitude) : null;
  const depth = (() => {
    const m = parseMetrics(p);
    const d = m.depth_km;
    return d != null && d !== "" ? Number(d) : null;
  })();
  const lon = p._lon != null ? Number(p._lon) : null;
  const lat = p._lat != null ? Number(p._lat) : null;
  const en = uiLang === "en";

  if (t === "earthquake") {
    const r = eqImpactRadiusKm(mag);
    const magTxt = mag != null && Number.isFinite(mag) ? `M${mag.toFixed(1)}` : en ? "mag. n/a" : "震级待定";
    const epi =
      lon != null && lat != null
        ? en
          ? `epicenter ~ ${fmtCoord(lat, lon)} (${place})`
          : `震中约在 ${fmtCoord(lat, lon)}（${place}）`
        : en
          ? `epicenter in ${place}`
          : `震中位于 ${place}`;
    const depthTxt =
      depth != null && Number.isFinite(depth)
        ? en
          ? `depth ~ ${fmtNum(depth)} km, `
          : `震源深度约 ${fmtNum(depth)} 公里，`
        : "";
    return en
      ? `${when} ${magTxt} quake: ${epi}. ${depthTxt}felt radius ~ ${r} km (est.). Grade: ${grade.text}.`
      : `${when} 发生${magTxt}地震：${epi}。${depthTxt}有感影响半径约 ${r} 公里（经验估算）。等级：${grade.text}。`;
  }

  if (t === "cyclone") {
    const track = parseFootprint(p);
    const pts = track && track.type === "LineString" ? track.coordinates.length : 0;
    const wind = mag != null ? (en ? `winds ~ ${fmtNum(mag)} kts, ` : `中心附近风速约 ${fmtNum(mag)} 节，`) : "";
    const pathTxt =
      pts >= 2
        ? en
          ? `${pts} track points on map.`
          : `已记录路径点 ${pts} 个，地图上以轨迹线标出。`
        : en
          ? "Track incomplete; current position only."
          : "路径点不足，仅标当前位置。";
    return en
      ? `${when} ${place} tropical cyclone: ${wind}${grade.text}. ${pathTxt}`
      : `${when} ${place} 热带气旋活动：${wind}${grade.text}。${pathTxt}`;
  }

  if (t === "wildfire") {
    const area = mag != null ? (en ? `~ ${fmtNum(mag)} acres, ` : `过火约 ${fmtNum(mag)} 英亩，`) : "";
    return en
      ? `${when} ${place} wildfire: ${area}${grade.text}.`
      : `${when} ${place} 野火：${area}${grade.text}。点位为当前目录记录位置。`;
  }

  if (t === "flood" || t === "landslide" || t === "debris_flow") {
    const kind = t === "flood" ? (en ? "Flood" : "洪水") : en ? "Landslide/debris flow" : "泥石流/滑坡";
    const flow =
      mag != null && t === "flood"
        ? en
          ? `discharge ~ ${fmtNum(mag)} m³/s, `
          : `监测径流量约 ${fmtNum(mag)} m³/s，`
        : "";
    return en
      ? `${when} ${place} ${kind}: ${flow}${grade.text}. Flow arrow when zoomed/focused.`
      : `${when} ${place} ${kind}：${flow}${grade.text}。放大或预览时地图显示示意流向箭头。`;
  }

  if (t === "volcano") {
    return en
      ? `${when} ${place} volcano: ${grade.text}.`
      : `${when} ${place} 火山活动：${grade.text}。标记为活动中心位置。`;
  }

  if (t === "drought") {
    return en
      ? `${when} ${place} drought: ${grade.text}.`
      : `${when} ${place} 干旱警报：${grade.text}。`;
  }

  if (t === "war" || t === "armed_clash" || t === "crisis_signal") {
    const met = parseMetrics(p);
    const kind = en
      ? t === "war"
        ? "state/proxy/border armed conflict"
        : t === "armed_clash"
          ? "armed clash"
          : "conflict media signal"
      : t === "war"
        ? "国家间/代理人/边境武装冲突级"
        : t === "armed_clash"
          ? "武装冲突"
          : "冲突媒体信号";
    const n = met.event_count || met.article_count || mag;
    const nTxt =
      n != null ? (en ? `${fmtNum(n)} signals in window, ` : `近窗聚合 ${fmtNum(n)} 起信号，`) : "";
    return en
      ? `${when} ${place} ${kind}: ${nTxt}${grade.text}. Theater-level coordinates.`
      : `${when} ${place} ${kind}：${nTxt}${grade.text}。坐标为战区/国家级示意位置，非战术点位。`;
  }

  return en
    ? `${when} ${place} ${typeLabel(t)}: ${grade.text}.`
    : `${when} ${place} ${typeLabel(t)}：${grade.text}。`;
}

function parseFootprint(p) {
  let fp = p.footprint;
  if (typeof fp === "string") {
    try {
      fp = JSON.parse(fp);
    } catch {
      fp = null;
    }
  }
  return fp;
}

/** 生成地图特效要素：地震圈（全局）、台风路径（全局）、洪水方向（放大/聚焦） */
function buildEffectFeatures(pointFeats, focusId) {
  const out = [];
  for (const f of pointFeats) {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const focused = focusId != null && String(p.id) === String(focusId) ? 1 : 0;
    const color = p.marker_color || mapMarkerColor(p);

    if (p.type === "earthquake") {
      const mag = Number(p.magnitude);
      // 全局：M≥4.0 始终画影响圈；小震仅在点击/空格预览聚焦时显示
      if (!focused && !(Number.isFinite(mag) && mag >= 4.0)) {
        /* skip small-eq rings on overview */
      } else {
        const r = eqImpactRadiusKm(mag);
        // 双圈：内圈强影响、外圈有感
        const rIn = Math.max(8, Math.round(r * 0.45));
        out.push({
          type: "Feature",
          geometry: makeCirclePolygon(lon, lat, rIn, 48),
          properties: {
            effect: "eq_ring",
            ring: "inner",
            parent_id: p.id,
            marker_color: color,
            radius_km: rIn,
            focused,
          },
        });
        out.push({
          type: "Feature",
          geometry: makeCirclePolygon(lon, lat, r, 64),
          properties: {
            effect: "eq_ring",
            ring: "outer",
            parent_id: p.id,
            marker_color: color,
            radius_km: r,
            focused,
          },
        });
      }
    }

    if (p.type === "cyclone") {
      const fp = parseFootprint(p);
      if (fp && fp.type === "LineString" && (fp.coordinates || []).length >= 2) {
        out.push({
          type: "Feature",
          geometry: fp,
          properties: {
            effect: "track",
            parent_id: p.id,
            marker_color: color,
            focused,
          },
        });
      }
    }

    // 洪水 / 泥石流示意方向（仅放大 zoom≥5.5 或聚焦预览时由图层 filter 显示）
    if (p.type === "flood" || p.type === "landslide" || p.type === "debris_flow") {
      const brg = floodBearingDeg(p);
      const len = 45;
      const tip = destPoint(lon, lat, brg, len);
      const mid = destPoint(lon, lat, brg, len * 0.7);
      const left = destPoint(mid[0], mid[1], brg + 140, 8);
      const right = destPoint(mid[0], mid[1], brg - 140, 8);
      out.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[lon, lat], tip] },
        properties: {
          effect: "flood_dir",
          parent_id: p.id,
          marker_color: color,
          focused,
          bearing: brg,
        },
      });
      out.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [left, tip, right] },
        properties: {
          effect: "flood_dir",
          parent_id: p.id,
          marker_color: color,
          focused,
          bearing: brg,
        },
      });
    }
  }
  return out;
}

/**
 * 刷新特效层（地震影响圈全局、台风路径全局、洪水方向按 zoom/聚焦）
 * @param {string|number|null} focusId 当前弹窗/空格预览中的事件 id
 */
function refreshEffectsFocus(focusId) {
  effectsFocusId = focusId != null ? focusId : null;
  if (!mapReady || !map.getSource("effects")) return;
  const base = buildEffectFeatures(lastEnrichedPoints, effectsFocusId);
  const features = _eqWaveExtras.length ? base.concat(_eqWaveExtras) : base;
  map.getSource("effects").setData({ type: "FeatureCollection", features });
}

/**
 * 是否闪烁：
 * 1) 发生时间或首次采集时间落在近 1 小时内
 * 2) 自本页首次将其标为闪烁起，未满 1 分钟
 * 超过 1 分钟闪烁时长 → 恢复正常静态点（仍为类型配色）
 */
function isLiveEvent(p) {
  const now = Date.now();
  const occ = p.occurred_at ? new Date(p.occurred_at).getTime() : NaN;
  const seen = p.first_seen_at ? new Date(p.first_seen_at).getTime() : NaN;
  const candidates = [occ, seen].filter(Number.isFinite);
  if (!candidates.length) return false;
  // 取较新的时间作为「近时」参考
  const ref = Math.max(...candidates);
  const age = now - ref;
  if (age < 0 || age > LIVE_WINDOW_MS) {
    blinkStartedAt.delete(p.id);
    return false;
  }

  const id = p.id;
  if (!blinkStartedAt.has(id)) {
    blinkStartedAt.set(id, now);
  }
  const started = blinkStartedAt.get(id);
  if (now - started >= BLINK_DURATION_MS) {
    return false; // 已连续闪烁满 1 分钟，恢复正常
  }
  return true;
}

function typeLabel(t) {
  return L().types[t] || t || L().unknown;
}
function catLabel(c) {
  return L().cats[c] || c || L().unknown;
}
function sourceLabel(s) {
  return L().sources[s] || s || L().unknown;
}
function unitLabel(u) {
  return L().units[u] || u || "";
}
function typeColor(t) {
  return TYPE_COLORS[t] || TYPE_COLOR_DEFAULT;
}

/**
 * 「地震」类型文字颜色（列表 / 弹窗）：
 * 震级 ≥7 → 红；≥5 → 黄；其余用类型默认色
 */
function typeTextColor(p) {
  const base = typeColor(p && p.type);
  if (!p || p.type !== "earthquake") return base;
  const mag =
    p.magnitude != null && p.magnitude !== "" && p.magnitude !== "null"
      ? Number(p.magnitude)
      : NaN;
  if (!Number.isFinite(mag)) return base;
  if (mag >= 7) return EQ_COLOR_M7;
  if (mag >= 5) return EQ_COLOR_M5;
  return base;
}

function typeTextStyle(p) {
  const c = typeTextColor(p);
  const bg = c.length === 7 ? `${c}22` : "rgba(240,180,41,0.14)";
  return `color:${c};background:${bg};border-color:${c}55`;
}

/* ISO3 → 中文国家名（启动时从 /data/iso3-zh.json 合并完整表） */
const ISO3_ZH = {
  CHN: "中国",
  USA: "美国",
  RUS: "俄罗斯",
  JPN: "日本",
  IND: "印度",
  GBR: "英国",
  FRA: "法国",
  DEU: "德国",
  UKR: "乌克兰",
  IRN: "伊朗",
  ISR: "以色列",
  TWN: "台湾",
  KOR: "韩国",
  PRK: "朝鲜",
};
/** 英文国名（从 place-labels 国家点填充） */
const ISO3_EN = {};

function countryLabel(iso) {
  if (!iso) return L().unknownRegion;
  const code = String(iso).toUpperCase();
  if (uiLang === "en") return ISO3_EN[code] || code;
  return ISO3_ZH[code] || code;
}

/** 加载完整中英地名表（国家中文名） */
async function loadIso3Zh() {
  try {
    const r = await fetch("/data/iso3-zh.json");
    if (!r.ok) return;
    const data = await r.json();
    if (data && typeof data === "object") Object.assign(ISO3_ZH, data);
  } catch (err) {
    console.warn("iso3-zh load", err);
  }
}

function parseMetrics(p) {
  let m = p && p.metrics;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      m = {};
    }
  }
  return m && typeof m === "object" ? m : {};
}

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  if (Math.abs(x) >= 10000) return Math.round(x).toLocaleString("zh-CN");
  if (Math.abs(x) >= 100) return x.toFixed(0);
  return (Math.round(x * 10) / 10).toString();
}

/**
 * 真实灾害等级（来自数据源物理量 / 官方警报，而非仅 0~1 severity）
 * 返回 { text, tone } tone: green|yellow|orange|red|neutral
 */
function realGrade(p) {
  const t = p.type;
  const met = parseMetrics(p);
  const mag =
    p.magnitude != null && p.magnitude !== "" && p.magnitude !== "null"
      ? Number(p.magnitude)
      : null;
  const alertRaw = met.gdacs_alert || met.usgs_alert || null;
  const alertKey = alertRaw ? String(alertRaw).toLowerCase() : "";

  // 官方警报色（GDACS / USGS alert）
  const en = uiLang === "en";
  const alertZh = en
    ? { green: "Green", yellow: "Yellow", orange: "Orange", red: "Red" }
    : { green: "绿色", yellow: "黄色", orange: "橙色", red: "红色" };
  const alertTone = ["green", "yellow", "orange", "red"].includes(alertKey) ? alertKey : null;

  if (t === "earthquake") {
    if (mag != null && Number.isFinite(mag)) {
      let band = en ? "Micro" : "微震";
      if (mag >= 8) band = en ? "Great" : "巨大地震";
      else if (mag >= 7) band = en ? "Major" : "大地震";
      else if (mag >= 6) band = en ? "Strong" : "强震";
      else if (mag >= 5) band = en ? "Moderate" : "中强震";
      else if (mag >= 4) band = en ? "Light" : "有感地震";
      else if (mag >= 3) band = en ? "Minor" : "小震";
      const tone = mag >= 7 ? "red" : mag >= 5 ? "yellow" : "neutral";
      const alertPart = alertTone
        ? en
          ? `${alertZh[alertKey]} alert · `
          : `${alertZh[alertKey]}警报 · `
        : "";
      return { text: `${alertPart}${band} M${mag.toFixed(1)}`, tone };
    }
    if (alertTone)
      return {
        text: en ? `${alertZh[alertKey]} alert` : `${alertZh[alertKey]}警报`,
        tone: alertTone,
      };
    return { text: en ? "Magnitude n/a" : "震级未定", tone: "neutral" };
  }

  if (t === "cyclone") {
    if (mag != null && Number.isFinite(mag)) {
      let band = en ? "TD" : "热带低压";
      let tone = "green";
      if (mag >= 137) {
        band = en ? "Cat-5 hurricane" : "五级飓风";
        tone = "red";
      } else if (mag >= 113) {
        band = en ? "Cat-4 hurricane" : "四级飓风";
        tone = "red";
      } else if (mag >= 96) {
        band = en ? "Cat-3 hurricane" : "三级飓风";
        tone = "orange";
      } else if (mag >= 83) {
        band = en ? "Cat-2 hurricane" : "二级飓风";
        tone = "orange";
      } else if (mag >= 64) {
        band = en ? "Cat-1 hurricane" : "一级飓风";
        tone = "yellow";
      } else if (mag >= 34) {
        band = en ? "Tropical storm" : "热带风暴";
        tone = "yellow";
      }
      const alertPart = alertTone ? `${alertZh[alertKey]} · ` : "";
      return {
        text: `${alertPart}${band} ${fmtNum(mag)} ${en ? "kts" : "节"}`,
        tone: alertTone || tone,
      };
    }
    if (alertTone)
      return {
        text: en ? `${alertZh[alertKey]} · cyclone` : `${alertZh[alertKey]}警报 · 气旋`,
        tone: alertTone,
      };
    return { text: en ? "Cyclone grade n/a" : "气旋等级未定", tone: "neutral" };
  }

  if (t === "wildfire") {
    if (mag != null && Number.isFinite(mag)) {
      // 过火面积（英亩）官方数据分档
      let band = en ? "Small fire" : "小型火场";
      let tone = "green";
      if (mag >= 100000) {
        band = en ? "Extremely large fire" : "特大火场";
        tone = "red";
      } else if (mag >= 10000) {
        band = en ? "Large fire" : "大型火场";
        tone = "orange";
      } else if (mag >= 1000) {
        band = en ? "Medium fire" : "中型火场";
        tone = "yellow";
      } else if (mag >= 100) {
        band = en ? "Notable fire" : "较大火场";
        tone = "yellow";
      }
      const alertPart = alertTone ? `${alertZh[alertKey]} · ` : "";
      return { text: `${alertPart}${band} ${fmtNum(mag)} ${en ? "acres" : "英亩"}`, tone: alertTone || tone };
    }
    if (alertTone) return { text: en ? `${alertZh[alertKey]} alert · wildfire` : `${alertZh[alertKey]}警报 · 野火`, tone: alertTone };
    return { text: en ? "Burn area n/a" : "火场规模未定", tone: "neutral" };
  }

  if (t === "flood") {
    if (alertTone) {
      return {
        text:
          mag != null && Number.isFinite(mag)
            ? en
              ? `${alertZh[alertKey]} alert · discharge ${fmtNum(mag)} m³/s`
              : `${alertZh[alertKey]}警报 · 径流 ${fmtNum(mag)} m³/s`
            : en
              ? `${alertZh[alertKey]} alert · flood`
              : `${alertZh[alertKey]}警报 · 洪水`,
        tone: alertTone,
      };
    }
    if (mag != null && Number.isFinite(mag)) {
      return { text: en ? `Discharge ${fmtNum(mag)} m³/s` : `径流量 ${fmtNum(mag)} m³/s`, tone: "yellow" };
    }
    return { text: en ? "Flood grade n/a" : "洪水等级未定", tone: "neutral" };
  }

  if (t === "volcano") {
    if (alertTone) return { text: en ? `${alertZh[alertKey]} alert · volcano` : `${alertZh[alertKey]}警报 · 火山活动`, tone: alertTone };
    return { text: mag != null ? (en ? `Volcano ${fmtNum(mag)}` : `火山活动 ${fmtNum(mag)}`) : (en ? "Volcano activity" : "火山活动"), tone: "orange" };
  }

  if (t === "drought") {
    if (alertTone) return { text: en ? `${alertZh[alertKey]} alert · drought` : `${alertZh[alertKey]}警报 · 干旱`, tone: alertTone };
    return { text: en ? "Drought alert" : "干旱预警", tone: "yellow" };
  }

  if (t === "war") {
    const level = met.war_level || (mag != null && mag >= 2.5 ? "high" : "medium");
    if (level === "high") return { text: en ? "High-intensity war zone / ongoing conflict" : "高强度战区 / 持续冲突", tone: "red" };
    if (level === "medium") return { text: en ? "Medium-intensity conflict zone" : "中等强度冲突关注区", tone: "orange" };
    return { text: en ? "Conflict watch area" : "冲突关注区", tone: "yellow" };
  }

  if (t === "crisis_signal" || t === "armed_clash") {
    const conf = Number(p.confidence);
    const arts = Number.isFinite(mag) ? mag : met.article_count || met.event_count || 0;
    let band = en ? "Low conf." : "低置信";
    let tone = "neutral";
    if (conf >= 0.7) {
      band = en ? "High conf." : "高置信";
      tone = "red";
    } else if (conf >= 0.45) {
      band = en ? "Medium conf." : "中置信";
      tone = "orange";
    } else if (conf >= 0.25) {
      band = en ? "Low conf." : "低置信";
      tone = "yellow";
    }
    const unit = p.unit === "events" ? (en ? "events" : "起事件") : (en ? "articles" : "篇报道");
    return { text: `${band} · ${fmtNum(arts)} ${unit}`, tone };
  }

  if (alertTone) return { text: en ? `${alertZh[alertKey]} alert` : `${alertZh[alertKey]}警报`, tone: alertTone };
  if (mag != null && Number.isFinite(mag)) {
    return { text: `${fmtNum(mag)} ${unitLabel(p.unit) || ""}`.trim(), tone: "neutral" };
  }
  return { text: en ? "Grade n/a" : "等级待定", tone: "neutral" };
}

function gradeBadgeHtml(p) {
  const g = realGrade(p);
  return `<span class="grade-badge g-${g.tone}">${escapeHtml(g.text)}</span>`;
}

function byTimeDesc(a, b) {
  const tb = new Date(b.properties.occurred_at || 0).getTime();
  const ta = new Date(a.properties.occurred_at || 0).getTime();
  return tb - ta;
}

function haversineKm(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLon = r(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/**
 * 重建巡览列表
 * - time：全局按发生时间新→旧
 * - region：锁定国家（或点击点周围半径）内按时间新→旧
 */
function rebuildTourList(enriched, opts = {}) {
  let list = (enriched || []).filter(
    (f) => f.geometry && f.geometry.type === "Point" && Array.isArray(f.geometry.coordinates),
  );

  if (tourScope === "region" && tourFocus) {
    if (tourFocus.country) {
      list = list.filter((f) => String(f.properties.country || "") === String(tourFocus.country));
    } else if (tourFocus.lon != null && tourFocus.lat != null) {
      const R = tourFocus.radiusKm || 1200;
      list = list.filter((f) => {
        const [lo, la] = f.geometry.coordinates;
        return haversineKm(tourFocus.lon, tourFocus.lat, lo, la) <= R;
      });
    }
  }

  list.sort(byTimeDesc);
  tourList = list;

  if (opts.anchorId != null) {
    const idx = tourList.findIndex((f) => String(f.properties.id) === String(opts.anchorId));
    tourIndex = idx >= 0 ? idx : -1;
    if (idx >= 0) tourActiveId = opts.anchorId;
  } else if (tourActiveId != null) {
    const idx = tourList.findIndex((f) => String(f.properties.id) === String(tourActiveId));
    if (idx >= 0) tourIndex = idx;
  }

  updateTourProgress();
  return tourList;
}

/** 鼠标点选事件/区域后，锁定区域巡览 */
function setTourRegionFocus(focus, opts = {}) {
  tourScope = "region";
  tourFocus = focus;
  rebuildTourList(lastEnrichedPoints, { anchorId: opts.anchorId });
  const liveCount = tourList.filter((x) => Number(x.properties.is_live) === 1).length;
  renderFeed(tourList.slice(0, 60), liveCount);
  const name = focus.name || countryLabel(focus.country) || "选定区域";
  const n = tourList.length;
  if (!opts.silent) {
    showToast("区域巡览", `已锁定「${name}」· 当前时段 ${n} 条 · 空格按时间顺序预览`);
  }
}

/** 恢复全局时间巡览 */
function setTourTimeScope(opts = {}) {
  tourScope = "time";
  tourFocus = null;
  rebuildTourList(lastEnrichedPoints, opts);
  const liveCount = tourList.filter((x) => Number(x.properties.is_live) === 1).length;
  renderFeed(tourList.slice(0, 60), liveCount);
  if (!opts.silent) {
    showToast("时间巡览", "已按最新灾害时间顺序预览");
  }
}

/* ========== 英文标题 → 中文展示（数据源原文多为英文） ========== */
const PLACE_ZH = {
  // 国家/地区
  indonesia: "印度尼西亚",
  china: "中国",
  japan: "日本",
  philippines: "菲律宾",
  "united states": "美国",
  usa: "美国",
  "u.s.": "美国",
  russia: "俄罗斯",
  chile: "智利",
  peru: "秘鲁",
  mexico: "墨西哥",
  canada: "加拿大",
  turkey: "土耳其",
  türkiye: "土耳其",
  greece: "希腊",
  italy: "意大利",
  iran: "伊朗",
  pakistan: "巴基斯坦",
  india: "印度",
  afghanistan: "阿富汗",
  taiwan: "台湾",
  "papua new guinea": "巴布亚新几内亚",
  "new zealand": "新西兰",
  australia: "澳大利亚",
  fiji: "斐济",
  tonga: "汤加",
  vanuatu: "瓦努阿图",
  "solomon islands": "所罗门群岛",
  alaska: "阿拉斯加",
  hawaii: "夏威夷",
  "puerto rico": "波多黎各",
  venezuela: "委内瑞拉",
  colombia: "哥伦比亚",
  ecuador: "厄瓜多尔",
  argentina: "阿根廷",
  bolivia: "玻利维亚",
  guatemala: "危地马拉",
  nicaragua: "尼加拉瓜",
  "costa rica": "哥斯达黎加",
  iceland: "冰岛",
  portugal: "葡萄牙",
  spain: "西班牙",
  france: "法国",
  germany: "德国",
  romania: "罗马尼亚",
  algeria: "阿尔及利亚",
  morocco: "摩洛哥",
  ethiopia: "埃塞俄比亚",
  kenya: "肯尼亚",
  "south africa": "南非",
  myanmar: "缅甸",
  thailand: "泰国",
  vietnam: "越南",
  "viet nam": "越南",
  laos: "老挝",
  cambodia: "柬埔寨",
  malaysia: "马来西亚",
  "south korea": "韩国",
  "north korea": "朝鲜",
  mongolia: "蒙古",
  nepal: "尼泊尔",
  bangladesh: "孟加拉国",
  "sri lanka": "斯里兰卡",
  "saudi arabia": "沙特阿拉伯",
  yemen: "也门",
  syria: "叙利亚",
  iraq: "伊拉克",
  ukraine: "乌克兰",
  poland: "波兰",
  norway: "挪威",
  sweden: "瑞典",
  "united kingdom": "英国",
  uk: "英国",
  brazil: "巴西",
  cuba: "古巴",
  haiti: "海地",
  jamaica: "牙买加",
  "dominican republic": "多米尼加",
  panama: "巴拿马",
  "el salvador": "萨尔瓦多",
  honduras: "洪都拉斯",
  // 美国州
  ca: "加州",
  california: "加州",
  ak: "阿拉斯加州",
  hi: "夏威夷州",
  nv: "内华达州",
  or: "俄勒冈州",
  wa: "华盛顿州",
  tx: "得克萨斯州",
  ok: "俄克拉荷马州",
  mt: "蒙大拿州",
  id: "爱达荷州",
  ut: "犹他州",
  az: "亚利桑那州",
  nm: "新墨西哥州",
  co: "科罗拉多州",
  wy: "怀俄明州",
  ny: "纽约州",
  pr: "波多黎各",
  nc: "北卡罗来纳州",
  sc: "南卡罗来纳州",
  fl: "佛罗里达州",
  mo: "密苏里州",
  ar: "阿肯色州",
  tn: "田纳西州",
  // 常见海域/区域词
  sea: "海",
  region: "地区",
  island: "岛",
  islands: "群岛",
  coast: "沿岸",
  ridge: "海岭",
  trench: "海沟",
  valley: "谷",
  bay: "湾",
  strait: "海峡",
  peninsula: "半岛",
  lake: "湖",
  eastern: "东部",
  western: "西部",
  northern: "北部",
  southern: "南部",
  central: "中部",
  near: "附近",
  off: "近海",
  offshore: "近海",
  the: "",
  of: "",
  // 常见地名（印尼等）
  ceram: "塞兰",
  flores: "弗洛勒斯",
  sumba: "松巴",
  java: "爪哇",
  sumatra: "苏门答腊",
  sulawesi: "苏拉威西",
  bali: "巴厘",
  lombok: "龙目",
  molucca: "马鲁古",
  banda: "班达",
  timor: "帝汶",
  halmahera: "哈马黑拉",
  minahasa: "米纳哈萨",
  sunda: "巽他",
  mentawai: "明打威",
  sichuan: "四川",
  yunnan: "云南",
  xinjiang: "新疆",
  tibet: "西藏",
  qinghai: "青海",
  gansu: "甘肃",
  "taiwan region": "台湾地区",
  honshu: "本州",
  hokkaido: "北海道",
  kyushu: "九州",
  shikoku: "四国",
  okinawa: "冲绳",
  kuril: "千岛",
  aleutian: "阿留申",
  "the geysers": "盖瑟斯",
  idyllwild: "艾德尔怀尔德",
  "san francisco": "旧金山",
  "los angeles": "洛杉矶",
  tokyo: "东京",
  manila: "马尼拉",
  jakarta: "雅加达",
  "mexico city": "墨西哥城",
  "south of": "以南",
  "north of": "以北",
  "east of": "以东",
  "west of": "以西",
  "southeast of": "东南方向",
  "southwest of": "西南方向",
  "northeast of": "东北方向",
  "northwest of": "西北方向",
  "near the coast of": "沿岸附近",
  "near east coast of": "东海岸附近",
  "near west coast of": "西海岸附近",
};

const DIR_ZH = {
  N: "正北",
  S: "正南",
  E: "正东",
  W: "正西",
  NE: "东北",
  NW: "西北",
  SE: "东南",
  SW: "西南",
  NNE: "北北东",
  ENE: "东北东",
  ESE: "东南东",
  SSE: "南南东",
  SSW: "南南西",
  WSW: "西南西",
  WNW: "西北西",
  NNW: "北北西",
};

const ALERT_ZH = {
  green: "绿色",
  yellow: "黄色",
  orange: "橙色",
  red: "红色",
  Green: "绿色",
  Yellow: "黄色",
  Orange: "橙色",
  Red: "红色",
};

function translatePlaceToken(token) {
  const t = token.trim();
  if (!t) return "";
  const low = t.toLowerCase();
  if (PLACE_ZH[low] !== undefined) return PLACE_ZH[low];
  // 全大写多词区域名：逐词译
  if (/^[A-Z][A-Z\s\-']+$/.test(t) || /^[A-Z0-9\s,\-'.]+$/.test(t)) {
    const words = t.replace(/,/g, " , ").split(/\s+/).filter(Boolean);
    const parts = words
      .map((w) => {
        if (w === ",") return "，";
        const lw = w.toLowerCase().replace(/^\(|\)$/g, "");
        if (PLACE_ZH[lw] !== undefined) return PLACE_ZH[lw];
        // 保留专有名：首字母大写转可读，未知则音译占位保留原文小写词
        if (/^[A-Z]+$/.test(w) && w.length > 1) {
          return PLACE_ZH[w.toLowerCase()] || titleCaseWord(w);
        }
        return PLACE_ZH[lw] || w;
      })
      .filter((x) => x !== "");
    return parts
      .join("")
      .replace(/\s*，\s*/g, "，")
      .replace(/\s+/g, " ")
      .trim();
  }
  return t;
}

function titleCaseWord(w) {
  const low = w.toLowerCase();
  return PLACE_ZH[low] || w.charAt(0) + w.slice(1).toLowerCase();
}

function translatePlacePhrase(s) {
  if (!s) return "";
  let t = s.trim();
  // 先替换长短语
  const phrases = Object.keys(PLACE_ZH).sort((a, b) => b.length - a.length);
  let low = t.toLowerCase();
  for (const p of phrases) {
    if (p.length < 3) continue;
    if (low.includes(p)) {
      const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
      t = t.replace(re, PLACE_ZH[p]);
      low = t.toLowerCase();
    }
  }
  // 剩余全大写片段
  t = t.replace(/[A-Z][A-Z][A-Z\s\-']*[A-Z]/g, (m) => translatePlaceToken(m.trim()) || m);
  return t
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, "，")
    .trim();
}

/**
 * 列表/弹窗标题：中文界面做汉化；英文界面保留原文（或类型+国家）
 */
function eventHeadline(p) {
  if (uiLang === "en") {
    const raw = (p.headline || "").trim();
    if (raw) return raw;
    const c = p.country ? ` (${countryLabel(p.country)})` : "";
    return `${typeLabel(p.type)}${c}`;
  }
  return chineseHeadline(p);
}

/**
 * 将数据源英文标题转为中文展示文案
 * @param {object} p 事件 properties
 */
function chineseHeadline(p) {
  const raw = (p.headline || "").trim();
  const typ = typeLabel(p.type);
  if (!raw) {
    const c = p.country ? `（${countryLabel(p.country)}）` : "";
    return `${typ}${c}`;
  }

  // 已是中文则直接返回
  if (/[\u4e00-\u9fff]/.test(raw) && !/[A-Za-z]{4,}/.test(raw)) return raw;

  let s = raw;

  // GDACS 类: "Orange M 6.3 Earthquake in China at: ..."
  let m = s.match(
    /^(Green|Yellow|Orange|Red)\s+M\s*([\d.]+)\s+Earthquake\s+in\s+(.+?)\s+at:\s*(.+)$/i,
  );
  if (m) {
    const alert = ALERT_ZH[m[1]] || m[1];
    const place = translatePlacePhrase(m[3]);
    return `${alert}预警 · M${m[2]} ${typ} · ${place}`;
  }
  m = s.match(
    /^(Green|Yellow|Orange|Red)\s+(Tropical Cyclone|Earthquake|Forest fires?|Eruption|Flood|Drought)\s+(.+)$/i,
  );
  if (m) {
    const alert = ALERT_ZH[m[1]] || m[1];
    const rest = translatePlacePhrase(m[3].replace(/\s+from:.*$/i, "").replace(/\s+at:.*$/i, ""));
    return `${alert}预警 · ${typ} · ${rest}`;
  }

  // USGS: "2 km ESE of The Geysers, CA"
  m = s.match(/^([\d.]+)\s*km\s+([A-Z]{1,3})\s+of\s+(.+)$/i);
  if (m) {
    const dir = DIR_ZH[m[2].toUpperCase()] || m[2];
    let place = m[3].trim();
    // 末尾州代码
    const sm = place.match(/^(.*?),\s*([A-Z]{2})$/);
    if (sm) {
      const city = translatePlacePhrase(sm[1]);
      const st = PLACE_ZH[sm[2].toLowerCase()] || sm[2];
      place = `${st}${city}`;
    } else {
      place = translatePlacePhrase(place);
    }
    return `${place}${dir}约 ${m[1]} 公里 · ${typ}`;
  }

  // "XX km N of Y"
  m = s.match(
    /^([\d.]+)\s*km\s+(north|south|east|west|northeast|northwest|southeast|southwest)\s+of\s+(.+)$/i,
  );
  if (m) {
    const dirMap = {
      north: "正北",
      south: "正南",
      east: "正东",
      west: "正西",
      northeast: "东北",
      northwest: "西北",
      southeast: "东南",
      southwest: "西南",
    };
    const place = translatePlacePhrase(m[3]);
    return `${place}${dirMap[m[2].toLowerCase()] || m[2]}约 ${m[1]} 公里 · ${typ}`;
  }

  // EMSC 全大写: "CERAM SEA, INDONESIA" / "EASTERN SICHUAN, CHINA"
  if (/^[A-Z0-9\s,.\-']+$/.test(s) && s.length > 2) {
    const parts = s.split(",").map((x) => translatePlaceToken(x.trim()));
    const place = parts.filter(Boolean).join("，");
    return `${place} · ${typ}`;
  }

  // "Wildfire NAME, County, State"
  m = s.match(/^Wildfire\s+(.+)$/i);
  if (m) {
    return `野火 · ${translatePlacePhrase(m[1])}`;
  }
  m = s.match(/^Incident Complex\s+(.+)$/i);
  if (m) {
    return `火灾复合体 · ${translatePlacePhrase(m[1])}`;
  }
  m = s.match(/^Tropical Storm\s+(.+)$/i);
  if (m) {
    return `热带风暴 ${m[1]}`;
  }
  m = s.match(/^Hurricane\s+(.+)$/i);
  if (m) {
    return `飓风 ${m[1]}`;
  }

  // 通用：国家名、方向短语替换 + 后缀类型
  let out = translatePlacePhrase(s);
  // 清理残留英文杂讯（短词保留）
  out = out
    .replace(/\bM\s*([\d.]+)\b/g, "M$1")
    .replace(/\bearthquake\b/gi, "地震")
    .replace(/\bwildfire\b/gi, "野火")
    .replace(/\bflood\b/gi, "洪水")
    .replace(/\bvolcano\b|\beruption\b/gi, "火山")
    .replace(/\bdrought\b/gi, "干旱")
    .replace(/\bcyclone\b|\btyphoon\b|\bhurricane\b/gi, "气旋")
    .replace(/\bforest fires?\b/gi, "森林火灾")
    .replace(/\bat:\s*/gi, "· ")
    .replace(/\bfrom:\s*/gi, "自 ")
    .replace(/\bto:\s*/gi, "至 ")
    .replace(/\s+/g, " ")
    .trim();

  // 若仍几乎全是英文，降级为「类型 · 国家」
  const latinRatio = out.replace(/[^A-Za-z]/g, "").length / Math.max(out.length, 1);
  if (latinRatio > 0.55) {
    const ctry = p.country ? PLACE_ZH[String(p.country).toLowerCase()] || p.country : "";
    const mag =
      p.magnitude != null && p.magnitude !== "" && p.magnitude !== "null" ? ` M${p.magnitude}` : "";
    return ctry ? `${ctry}${mag} · ${typ}` : `${typ}${mag} · ${out.slice(0, 40)}`;
  }

  // 标题里还没有类型字样时补上
  if (!/地震|野火|洪水|火山|干旱|气旋|台风|冲突|危机/.test(out)) {
    out = `${out} · ${typ}`;
  }
  return out;
}

/**
 * 类型图层筛选 UI（可勾选；配色点 + 数量）
 * 取代只读图例；地震震级色见 #eqGradeHint
 */
function renderTypeLegend() {
  const el = document.getElementById("typeLegend");
  if (!el) return;

  // 全量统计（不受类型筛选影响，便于用户看到「库里有多少」）
  const counts = {};
  for (const it of FILTERABLE_TYPES) counts[it.type] = 0;
  for (const f of lastFeatures) {
    const t = f.properties && f.properties.type;
    if (t && counts[t] != null) counts[t] += 1;
  }

  el.innerHTML = FILTERABLE_TYPES.map((it) => {
    const checked = isTypeEnabled(it.type) ? "checked" : "";
    const color = TYPE_COLORS[it.type] || TYPE_COLOR_DEFAULT;
    const label = typeLabel(it.type);
    const n = counts[it.type] || 0;
    const offCls = isTypeEnabled(it.type) ? "" : " is-off";
    return `
    <label class="legend-item legend-filter${offCls}" data-type="${escapeHtml(it.type)}" title="${escapeHtml(label)}">
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

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d
      .toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(/\//g, "-");
  } catch {
    return String(iso).slice(0, 16).replace("T", " ");
  }
}

function fmtAge(sec) {
  if (sec == null) return L().never;
  if (sec < 90) return L().justNow;
  if (sec < 3600) return L().minutesAgo(Math.floor(sec / 60));
  return L().hoursAgo(Math.floor(sec / 3600));
}

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
// 免费公开栅格：Esri 影像 / OpenTopoMap 地形（需联网；离线时仍保留国界矢量）
const SURFACE_TILES = {
  sat: {
    // Esri 影像 + 高缩放清晰；tileSize 256 标准
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    maxzoom: 18,
    attribution: "Esri World Imagery",
  },
  // 矢量注记层（更高细节地名/道路，叠在影像上）
  labels: {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    ],
    maxzoom: 18,
    attribution: "Esri Boundaries",
  },
  topo: {
    tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
    maxzoom: 17,
    attribution: "© OpenStreetMap, SRTM | OpenTopoMap",
  },
};

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    // 英文字形；中日韩用 localIdeographFontFamily（系统字体）
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      {
        id: "bg",
        type: "background",
        paint: { "background-color": "#02060e" },
      },
    ],
  },
  center: [20, 25],
  zoom: 1.55,
  minZoom: 0.8,
  maxZoom: 18,
  // 高分屏更细
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  // 中文用系统字体渲染（Win: 微软雅黑 / Noto Sans SC）
  localIdeographFontFamily: "'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Source Han Sans SC', sans-serif",
  attributionControl: true,
  renderWorldCopies: false,
  fadeDuration: 200,
  maxTileCacheSize: 120,
  // 静态底图（Esri/OpenTopoMap）不刷新过期瓦片，避免视野回到已加载区域时重复请求
  refreshExpiredTiles: false,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), "bottom-right");

/** 按界面语言返回地图地名 text-field 表达式（单语，不叠双行） */
function placeLabelTextField() {
  // 中文界面 → name_zh；英文界面 → name_en（缺省回退中文）
  if (uiLang === "en") {
    return ["coalesce", ["get", "name_en"], ["get", "name_zh"], ""];
  }
  return ["coalesce", ["get", "name_zh"], ["get", "name_en"], ""];
}

/** 切换地图地名语言（与 UI 语言一致） */
function applyPlaceLabelLang() {
  if (!mapReady) return;
  const field = placeLabelTextField();
  for (const id of ["label-continent", "label-ocean", "label-country", "label-city"]) {
    if (!map.getLayer(id)) continue;
    try {
      map.setLayoutProperty(id, "text-field", field);
    } catch (err) {
      console.warn("place label lang", id, err);
    }
  }
  // 英文界面可略提高 Esri 英文栅格辅助；中文界面保持极淡避免叠字
  if (map.getLayer("surface-labels")) {
    try {
      map.setPaintProperty(
        "surface-labels",
        "raster-opacity",
        uiLang === "en" ? 0.28 : 0.08,
      );
    } catch (_) {}
  }
}

/**
 * 地图地名注记：大洲 / 大洋 / 国家 / 主要城市
 * 单语显示，跟随界面语言（中文或 English）
 */
async function addBilingualPlaceLabels() {
  if (!map.getSource("place-labels")) {
    map.addSource("place-labels", {
      type: "geojson",
      data: "/data/place-labels.geojson",
      attribution: "Place labels",
    });
    // 同步填充英文国名表
    try {
      const r = await fetch("/data/place-labels.geojson");
      const fc = await r.json();
      for (const f of fc.features || []) {
        const p = f.properties || {};
        if (p.kind === "country" && p.iso3 && p.name_en) {
          ISO3_EN[String(p.iso3).toUpperCase()] = p.name_en;
        }
      }
    } catch (_) {}
  }

  const textFont = ["Noto Sans Regular"];
  const halo = {
    "text-halo-color": "rgba(2, 8, 18, 0.88)",
    "text-halo-width": 1.35,
    "text-halo-blur": 0.4,
  };

  const commonLayout = {
    "text-field": placeLabelTextField(),
    "text-font": textFont,
    "text-anchor": "center",
    "text-justify": "center",
    "text-line-height": 1.05,
    "text-max-width": 8,
    "text-padding": 2,
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "symbol-sort-key": ["coalesce", ["get", "rank"], 9],
  };

  // 大洲：总览即见
  if (!map.getLayer("label-continent")) {
    map.addLayer({
      id: "label-continent",
      type: "symbol",
      source: "place-labels",
      minzoom: 0,
      maxzoom: 3.4,
      filter: ["==", ["get", "kind"], "continent"],
      layout: {
        ...commonLayout,
        "text-size": ["interpolate", ["linear"], ["zoom"], 0, 15, 2, 18, 3.2, 16],
        "text-letter-spacing": 0.06,
        "text-transform": "none",
      },
      paint: {
        "text-color": "#f0f7fc",
        "text-opacity": 0.95,
        ...halo,
        "text-halo-width": 1.6,
      },
    });
  }

  // 大洋 / 海域
  if (!map.getLayer("label-ocean")) {
    map.addLayer({
      id: "label-ocean",
      type: "symbol",
      source: "place-labels",
      minzoom: 0,
      maxzoom: 5.8,
      filter: ["==", ["get", "kind"], "ocean"],
      layout: {
        ...commonLayout,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          ["case", ["==", ["get", "rank"], 1], 13, 11],
          3,
          ["case", ["==", ["get", "rank"], 1], 15, 12],
          5,
          12,
        ],
        "text-letter-spacing": 0.08,
        "text-max-width": 10,
      },
      paint: {
        "text-color": "#9fd4e8",
        "text-opacity": 0.88,
        ...halo,
      },
    });
  }

  // 国家
  if (!map.getLayer("label-country")) {
    map.addLayer({
      id: "label-country",
      type: "symbol",
      source: "place-labels",
      minzoom: 1.4,
      maxzoom: 6.8,
      filter: ["==", ["get", "kind"], "country"],
      layout: {
        ...commonLayout,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1.5,
          ["case", ["==", ["get", "rank"], 1], 11, 9.5],
          3,
          ["case", ["==", ["get", "rank"], 1], 13, 11],
          5.5,
          12,
        ],
        "text-padding": 4,
      },
      paint: {
        "text-color": "#e8f2fa",
        "text-opacity": 0.92,
        ...halo,
      },
    });
  }

  // 主要城市
  if (!map.getLayer("label-city")) {
    map.addLayer({
      id: "label-city",
      type: "symbol",
      source: "place-labels",
      minzoom: 3.6,
      maxzoom: 14,
      filter: ["==", ["get", "kind"], "city"],
      layout: {
        ...commonLayout,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3.8,
          ["case", ["==", ["get", "rank"], 1], 11, 9.5],
          6,
          ["case", ["==", ["get", "rank"], 1], 13, 11],
          10,
          14,
        ],
        "text-offset": [0, 0.15],
        "text-padding": 3,
        // 城市旁小圆点
        "icon-size": 0.35,
      },
      paint: {
        "text-color": "#fff8e8",
        "text-opacity": 0.95,
        ...halo,
        "text-halo-width": 1.2,
      },
    });
  }

  // 城市圆点（独立图层，避免与 text 抢 placement 过度）
  if (!map.getLayer("label-city-dot")) {
    map.addLayer(
      {
        id: "label-city-dot",
        type: "circle",
        source: "place-labels",
        minzoom: 3.6,
        maxzoom: 14,
        filter: ["==", ["get", "kind"], "city"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            2.2,
            8,
            3.2,
            12,
            4,
          ],
          "circle-color": "rgba(255, 248, 230, 0.92)",
          "circle-stroke-color": "rgba(2, 8, 18, 0.75)",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      },
      "label-city",
    );
  }

  applyPlaceLabelLang();
}

/** 应用界面语言：静态 DOM + 地图地名 + 动态列表重绘 */
function applyUiLang(lang, opts = {}) {
  if (lang !== "zh" && lang !== "en") return;
  uiLang = lang;
  try {
    localStorage.setItem("crisis_ui_lang", uiLang);
  } catch (_) {}

  document.documentElement.lang = uiLang === "en" ? "en" : "zh-CN";
  document.title = UI_I18N[uiLang].title;

  // data-i18n 文本节点
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = UI_I18N[uiLang][key];
    if (val != null) el.textContent = val;
  });
  // data-i18n-title
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const val = UI_I18N[uiLang][key];
    if (val != null) el.title = val;
  });
  updatePanelsToggleButton();

  // 语言按钮态
  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === uiLang);
  });

  // 地图地名
  applyPlaceLabelLang();

  // 动态面板
  const hint = document.getElementById("viewHint");
  if (hint) {
    hint.textContent = currentView === "local" ? L().viewLocal : L().viewGlobal;
  }
  // 状态 pill 文案随语言更新（保持横向 DOM）
  const livePill = document.getElementById("livePill");
  if (livePill) {
    const ok = !livePill.classList.contains("is-err");
    setLivePill(ok);
  }
  renderTypeLegend();
  if (lastFeatures.length) applyFeatures(lastFeatures);
  if (opts.toast) {
    showToast(uiLang === "en" ? "Language" : "语言", L().langSwitched);
  }
}

/** 同步全局信息面板按钮文案/状态；顶部控制条始终保留以便恢复。 */
function updatePanelsToggleButton() {
  const button = document.getElementById("btnPanels");
  if (!button) return;
  const pack = UI_I18N[uiLang] || UI_I18N.zh;
  const key = panelsCollapsed ? "panelsShow" : "panelsHide";
  const titleKey = panelsCollapsed ? "panelsShowTitle" : "panelsHideTitle";
  const label = button.querySelector(".panel-toggle-label");
  const icon = button.querySelector(".panel-toggle-icon");
  if (label) label.textContent = pack[key] || (panelsCollapsed ? "展开面板" : "收起面板");
  if (icon) icon.textContent = panelsCollapsed ? "▣" : "▤";
  button.title = pack[titleKey] || "";
  button.setAttribute("aria-label", pack[titleKey] || pack[key] || "");
  button.setAttribute("aria-pressed", panelsCollapsed ? "true" : "false");
  button.classList.toggle("collapsed", panelsCollapsed);
}

/**
 * 一键收起/展开浮动信息面板（统计、筛选、健康、事件流、巡览条、免责声明）。
 * 顶栏控制条与地图控件始终保留。
 */
function setPanelsCollapsed(collapsed, { persist = true, toast = false } = {}) {
  panelsCollapsed = Boolean(collapsed);
  document.body.classList.toggle("panels-collapsed", panelsCollapsed);
  if (persist) {
    try {
      localStorage.setItem("crisis_panels_collapsed", String(panelsCollapsed));
    } catch (_) {}
  }
  updatePanelsToggleButton();
  // 面板显隐后触发地图重算尺寸，避免黑边/空白
  if (mapReady && map) {
    try {
      requestAnimationFrame(() => {
        try {
          map.resize();
        } catch (_) {}
      });
    } catch (_) {}
  }
  if (toast) {
    const pack = UI_I18N[uiLang] || UI_I18N.zh;
    showToast(
      uiLang === "en" ? "Panels" : "信息面板",
      panelsCollapsed
        ? pack.panelsHideTitle || (uiLang === "en" ? "Panels hidden" : "已收起信息面板")
        : pack.panelsShowTitle || (uiLang === "en" ? "Panels shown" : "已展开信息面板"),
    );
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
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        1, 0.4,
        4, 0.9,
        8, 1.4,
        12, 2.0,
      ],
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
      "fill-opacity": [
        "case",
        ["==", ["get", "ring"], "inner"],
        0.14,
        0.07,
      ],
    },
  });
  map.addLayer({
    id: "fx-eq-line",
    type: "line",
    source: "effects",
    filter: ["==", ["get", "effect"], "eq_ring"],
    paint: {
      "line-color": ["coalesce", ["get", "marker_color"], "#f0b429"],
      "line-width": [
        "case",
        ["==", ["get", "ring"], "inner"],
        1.6,
        1.1,
      ],
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
  // 洪水/干旱方向（仅放大 zoom>=5.5 或聚焦预览时显示）
  map.addLayer({
    id: "fx-flood-dir",
    type: "line",
    source: "effects",
    filter: [
      "all",
      ["==", ["get", "effect"], "flood_dir"],
      [
        "any",
        [">=", ["zoom"], 5.5],
        ["==", ["get", "focused"], 1],
      ],
    ],
    paint: {
      "line-color": ["coalesce", ["get", "marker_color"], "#2bb0ed"],
      "line-width": 2.2,
      "line-opacity": 0.88,
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
      "circle-opacity": ["*", 0.9, ["get", "confidence"]],
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
    // 手动点选事件 → 锁定该国/就近区域，空格改为区域内按时间巡览
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
  map.on("click", "ev-point", openPopup);
  map.on("click", "ev-live-core", openPopup);
  map.on("click", "ev-live-ring", openPopup);
  map.on("click", onMapBackgroundClick);
  ["ev-point", "ev-live-core", "ev-live-ring"].forEach((layer) => {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  });

  mapReady = true;
  // dev 模式：暴露 map 实例供 B2 测量脚本触发程序化 zoom
  if (import.meta.env?.DEV) window.__crisisMap = map;
  // 默认平面 + 卫星地表
  applyMapMode("flat", { silent: true });
  applySurfaceMode("sat", { silent: true });
  startLivePulse();
  await refresh();
  setInterval(refresh, 60000);
  setInterval(loadHealth, 30000);
  // 每 5 秒重算闪烁态：满 1 分钟后自动恢复静态类型色点
  setInterval(() => {
    if (lastFeatures.length) applyFeatures(lastFeatures);
  }, 5000);
  loadHealth();
  connectWS();
});

/* 投影切换锁，避免连点打断动画 */
let mapModeAnimating = false;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutQuart = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

function easePromise(opts) {
  return new Promise((resolve) => {
    if (!mapReady) {
      resolve();
      return;
    }
    try {
      map.stop();
    } catch (_) {}
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        map.off("moveend", finish);
      } catch (_) {}
      resolve();
    };
    try {
      map.once("moveend", finish);
      map.easeTo({ essential: true, ...opts });
    } catch (err) {
      console.warn("easePromise", err);
      finish();
      return;
    }
    setTimeout(finish, (opts.duration || 1000) + 500);
  });
}

function safeSetProjection(type) {
  try {
    map.setProjection({ type });
    return true;
  } catch (err) {
    console.warn("setProjection", type, err);
    return false;
  }
}

function safeClearTerrain() {
  try {
    map.setTerrain(null);
  } catch (_) {
    try {
      map.setTerrain(undefined);
    } catch (_) {}
  }
}

function safeClearFog() {
  try {
    map.setFog(null);
  } catch (_) {
    try {
      // 部分版本不接受 null，用透明雾近似关闭
      map.setFog({
        range: [2, 20],
        color: "rgba(2,6,14,0)",
        "horizon-blend": 0.01,
        "star-intensity": 0,
      });
    } catch (_) {}
  }
}

function setGlobeFog(intensity = 1) {
  // intensity 0~1：过渡过程中逐步加强星空/地平线；失败不抛到上层
  const i = Math.max(0, Math.min(1, intensity));
  try {
    map.setFog({
      range: [0.8, 12],
      color: `rgb(${Math.round(8 + 4 * i)}, ${Math.round(12 + 6 * i)}, ${Math.round(24 + 10 * i)})`,
      "high-color": `rgb(${Math.round(30 + 25 * i)}, ${Math.round(55 + 30 * i)}, ${Math.round(100 + 45 * i)})`,
      "space-color": "rgb(2, 4, 12)",
      "horizon-blend": 0.04 + 0.04 * i,
      "star-intensity": 0.15 + 0.4 * i,
    });
  } catch (err) {
    console.warn("setGlobeFog", err);
  }
}

/** 强制进入某形态并清理 CSS/交互残留（失败恢复用） */
function forceMapMode(mode) {
  stageResetMorph();
  safeClearTerrain();
  if (mode === "globe") {
    if (!safeSetProjection("globe")) {
      safeSetProjection("mercator");
      safeClearFog();
      return false;
    }
    setGlobeFog(1);
    // 地球仪默认不加 terrain：globe+terrain 在部分环境会抛错导致切换失败
  } else {
    safeSetProjection("mercator");
    safeClearFog();
  }
  try {
    map.resize();
  } catch (_) {}
  return true;
}

function syncMapModeButtons(mode) {
  document.querySelectorAll("[data-mapmode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mapmode === mode);
  });
}

/**
 * 平面图 ⇄ 地球仪
 * - 成功后才提交 mapMode
 * - 失败必复位 CSS + 投影，绝不留下「倒过来」的卷曲态
 * - 动画失败时降级为瞬间切投影
 */
async function applyMapMode(mode, opts = {}) {
  if (mode !== "flat" && mode !== "globe") return;

  if (!mapReady && !opts.force && !opts.silent) {
    mapMode = mode;
    syncMapModeButtons(mode);
    return;
  }

  if (opts.silent) {
    const ok = forceMapMode(mode);
    mapMode = ok ? mode : "flat";
    syncMapModeButtons(mapMode);
    return;
  }

  if (mapMode === mode) {
    syncMapModeButtons(mode);
    // 若 CSS 残留导致视觉异常，点同一按钮也可复位
    stageResetMorph();
    return;
  }
  if (mapModeAnimating) return;

  mapModeAnimating = true;
  const prev = mapMode;
  syncMapModeButtons(mode); // 按钮先反馈目标态

  try {
    map.boxZoom.disable();
    map.dragPan.disable();
    map.scrollZoom.disable();
  } catch (_) {}

  try {
    if (mode === "globe") {
      await transitionFlatToGlobe();
    } else {
      await transitionGlobeToFlat();
    }
    mapMode = mode;
    stageResetMorph();
    try {
      map.resize();
    } catch (_) {}
    showToast(L().mapForm, mode === "globe" ? L().mapGlobe : L().mapFlat);
  } catch (err) {
    console.warn("applyMapMode animated failed, fallback", err);
    // 动画失败 → 瞬间切投影（无 CSS 卷曲）
    stageResetMorph();
    const ok = forceMapMode(mode);
    if (ok) {
      mapMode = mode;
      syncMapModeButtons(mode);
      showToast(L().mapForm, mode === "globe" ? L().mapGlobeFast : L().mapFlatFast);
    } else {
      forceMapMode(prev);
      mapMode = prev;
      syncMapModeButtons(prev);
      showToast(L().mapForm, L().mapFail);
    }
  } finally {
    stageResetMorph();
    try {
      map.boxZoom.enable();
      map.dragPan.enable();
      map.scrollZoom.enable();
    } catch (_) {}
    mapModeAnimating = false;
  }
}

function getMapStage() {
  return document.getElementById("map-stage");
}

function waitMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MORPH_CLASSES = [
  "morph-roll-in",
  "morph-roll-out",
  "morph-unroll",
  "morph-unroll-globe",
  "morph-unroll-flat",
];

/** CSS 卷起 / 展开关键帧（与 styles.css 时长对齐） */
async function stageMorph(className, durationMs) {
  const stage = getMapStage();
  if (!stage) {
    await waitMs(durationMs);
    return;
  }
  stage.classList.add("is-morphing");
  MORPH_CLASSES.forEach((c) => stage.classList.remove(c));
  // 清掉可能残留的内联 transform，保证 animation 从头播放
  stage.style.transform = "";
  stage.style.filter = "";
  stage.style.opacity = "";
  stage.style.borderRadius = "";
  void stage.offsetWidth;
  stage.classList.add(className);
  await waitMs(durationMs);
}

function stageResetMorph() {
  const stage = getMapStage();
  if (!stage) return;
  stage.classList.remove("is-morphing", ...MORPH_CLASSES);
  stage.style.transform = "";
  stage.style.filter = "";
  stage.style.opacity = "";
  stage.style.borderRadius = "";
  stage.style.animation = "";
}

/**
 * 平面 → 地球仪：
 * 拉远 → 纸面卷起 → 切 globe + 雾 → 圆角展开成球 → 轻旋定格
 */
async function transitionFlatToGlobe() {
  const c = map.getCenter();
  const z0 = map.getZoom();
  const midLat = Math.max(-22, Math.min(22, c.lat * 0.45));
  const midLng = c.lng;
  const globeLat = Math.max(-10, Math.min(10, midLat * 0.4));

  safeClearTerrain();

  // 1) 镜头先退到适合「整张地图成纸」的视距（与卷起并行感）
  const pullBack = easePromise({
    center: [midLng, midLat],
    zoom: Math.min(z0, 2.15),
    pitch: 0,
    bearing: map.getBearing() * 0.15,
    duration: 780,
    easing: easeInOutCubic,
  });
  // 卷起稍晚启动，形成「先松手再卷」
  await waitMs(180);
  const curl = stageMorph("morph-roll-in", 950);
  await Promise.all([pullBack, curl]);

  // 2) 卷到最紧：切换球体投影 + 星空雾（视觉仍是卷筒）
  if (!safeSetProjection("globe")) {
    throw new Error("globe projection unsupported");
  }
  setGlobeFog(0.35);
  try {
    map.jumpTo({
      center: [midLng, globeLat],
      zoom: 1.48,
      pitch: 0,
      bearing: 0,
    });
    map.resize();
  } catch (_) {}

  // 3) 展开：圆角筒 → 球 → 铺满，同时雾变浓、球轻旋
  setGlobeFog(0.7);
  const unroll = stageMorph("morph-unroll-globe", 1150);
  const spin = easePromise({
    center: [midLng, globeLat * 0.6],
    zoom: 1.32,
    pitch: 0,
    bearing: 22,
    duration: 1200,
    easing: easeOutQuint,
  });
  await Promise.all([unroll, spin]);
  setGlobeFog(1);

  stageResetMorph();
  try {
    map.resize();
  } catch (_) {}
}

/**
 * 地球仪 → 平面：
 * 收束成圆 → 卷起 → 切 mercator → 铺平展开 → 飞到目标视距
 */
async function transitionGlobeToFlat() {
  const c = map.getCenter();
  const targetCenter = currentView === "local" ? LOCAL_CENTER : [20, 25];
  const targetZoom = currentView === "local" ? 3.5 : 1.7;

  // 1) 球体先回正、略放大，准备「收成纸筒」
  await easePromise({
    center: [
      c.lng * 0.55 + targetCenter[0] * 0.45,
      Math.max(-35, Math.min(45, c.lat * 0.55 + targetCenter[1] * 0.45)),
    ],
    zoom: Math.min(Math.max(map.getZoom(), 1.55), 2.4),
    pitch: 0,
    bearing: 0,
    duration: 720,
    easing: easeInOutQuart,
  });

  // 2) 卷起球体
  await stageMorph("morph-roll-out", 900);

  // 3) 最紧时切回平面投影
  safeClearTerrain();
  safeClearFog();
  if (!safeSetProjection("mercator")) {
    throw new Error("mercator projection failed");
  }
  try {
    map.jumpTo({
      center: [
        c.lng * 0.3 + targetCenter[0] * 0.7,
        c.lat * 0.3 + targetCenter[1] * 0.7,
      ],
      zoom: Math.max(1.9, targetZoom - 0.15),
      pitch: 0,
      bearing: 0,
    });
    map.resize();
  } catch (_) {}

  // 4) 铺平展开 + 飞到最终总览
  const unroll = stageMorph("morph-unroll-flat", 1050);
  const settle = easePromise({
    center: targetCenter,
    zoom: targetZoom,
    pitch: 0,
    bearing: 0,
    duration: 1100,
    easing: easeOutCubic,
  });
  await Promise.all([unroll, settle]);

  stageResetMorph();
  try {
    map.resize();
  } catch (_) {}
}

/** 卫星影像 / 地形地貌 地表切换 */
function applySurfaceMode(mode, opts = {}) {
  surfaceMode = mode;
  document.querySelectorAll("[data-surface]").forEach((b) => {
    b.classList.toggle("active", b.dataset.surface === mode);
  });
  if (!mapReady) return;
  const showSat = mode === "sat";
  if (map.getLayer("surface-sat")) {
    map.setLayoutProperty("surface-sat", "visibility", showSat ? "visible" : "none");
  }
  if (map.getLayer("surface-topo")) {
    map.setLayoutProperty("surface-topo", "visibility", showSat ? "none" : "visible");
  }
  if (map.getLayer("surface-labels")) {
    map.setLayoutProperty("surface-labels", "visibility", showSat ? "visible" : "none");
  }
  // 地形图时国界线加深，便于读行政区
  if (map.getLayer("country-line")) {
    map.setPaintProperty(
      "country-line",
      "line-color",
      showSat ? "rgba(230, 240, 255, 0.55)" : "rgba(30, 40, 50, 0.7)",
    );
  }
  if (map.getLayer("country-fill")) {
    map.setPaintProperty("country-fill", "fill-opacity", showSat ? 0.08 : 0.03);
  }
  if (!opts.silent) {
    showToast(L().surface, showSat ? L().surfaceSat : L().surfaceTopo);
  }
}

/** 进行中事件外圈/光晕呼吸闪烁（仅 transform 类 paint，GPU 友好） */
function startLivePulse() {
  if (window._livePulseStarted) return;
  window._livePulseStarted = true;
  const tick = (ts) => {
    if (mapReady && map.getLayer("ev-live-ring")) {
      // 1.25s 周期，0→1→0
      const s = 0.5 + 0.5 * Math.sin(((ts / 1000) * Math.PI * 2) / 1.25);
      try {
        map.setPaintProperty("ev-live-glow", "circle-radius", [
          "interpolate",
          ["linear"],
          ["get", "severity"],
          0,
          12 + s * 10,
          0.5,
          20 + s * 14,
          1,
          30 + s * 18,
        ]);
        map.setPaintProperty("ev-live-glow", "circle-opacity", 0.08 + s * 0.28);
        map.setPaintProperty("ev-live-ring", "circle-radius", [
          "interpolate",
          ["linear"],
          ["get", "severity"],
          0,
          7 + s * 5,
          0.5,
          12 + s * 7,
          1,
          18 + s * 10,
        ]);
        map.setPaintProperty("ev-live-ring", "circle-stroke-opacity", 0.35 + s * 0.6);
        map.setPaintProperty("ev-live-ring", "circle-stroke-width", 1.4 + s * 1.6);
        map.setPaintProperty("ev-live-core", "circle-opacity", 0.55 + s * 0.45);
        map.setPaintProperty("ev-live-core", "circle-radius", [
          "interpolate",
          ["linear"],
          ["get", "severity"],
          0,
          4 + s * 1.2,
          0.5,
          8 + s * 2,
          1,
          14 + s * 3,
        ]);
      } catch (_) {
        /* 图层未就绪时忽略 */
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inLocal(lon, lat) {
  return (
    lon >= LOCAL_BOUNDS[0][0] &&
    lon <= LOCAL_BOUNDS[1][0] &&
    lat >= LOCAL_BOUNDS[0][1] &&
    lat <= LOCAL_BOUNDS[1][1]
  );
}

function setView(view) {
  currentView = view;
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  document.getElementById("viewHint").textContent = view === "local" ? L().viewLocal : L().viewGlobal;

  if (!mapReady) return;
  if (view === "local") {
    map.flyTo({ center: LOCAL_CENTER, zoom: 3.4, duration: 1400, essential: true });
    map.setPaintProperty("china-highlight", "line-width", 1.8);
    map.setPaintProperty("china-highlight", "line-opacity", 0.85);
  } else {
    map.flyTo({ center: [20, 25], zoom: 1.55, duration: 1400, essential: true });
    map.setPaintProperty("china-highlight", "line-width", 0);
    map.setPaintProperty("china-highlight", "line-opacity", 0);
  }
  applyFeatures(lastFeatures);
}

document.getElementById("btnGlobal").addEventListener("click", () => setView("global"));
document.getElementById("btnLocal").addEventListener("click", () => setView("local"));

async function refresh() {
  const hours = document.getElementById("hours").value;
  try {
    // 开发模式：?fixtures=test 时加载本地测试夹具（手测台风轨迹/洪水箭头等 DB 无数据的路径）
    if (import.meta.env?.DEV && new URLSearchParams(location.search).get("fixtures") === "test") {
      const fr = await fetch(`/test-fixtures.json`, { cache: "no-store" });
      if (!fr.ok) throw new Error("fixtures " + fr.status);
      const fc = await fr.json();
      if (!fc || !Array.isArray(fc.features)) throw new Error("invalid fixtures payload");
      lastFeatures = fc.features;
      applyFeatures(lastFeatures);
      setLivePill(true);
      return;
    }
    // 健康检查 + 事件并行，任一失败才判连接异常
    const [hr, er] = await Promise.all([
      fetch(`/api/health`, { cache: "no-store" }),
      fetch(`/api/events?hours=${hours}&limit=5000`, { cache: "no-store" }),
    ]);
    if (!hr.ok && !er.ok) throw new Error(`health ${hr.status} events ${er.status}`);
    if (!er.ok) throw new Error("events " + er.status);
    const fc = await er.json();
    if (!fc || !Array.isArray(fc.features)) throw new Error("invalid events payload");
    lastFeatures = fc.features;
    applyFeatures(lastFeatures);
    // 同步健康面板
    if (hr.ok) {
      try {
        const h = await hr.json();
        renderHealth(h);
      } catch (_) {}
    }
    setLivePill(true);
  } catch (e) {
    console.warn("refresh failed", e);
    setLivePill(false);
  }
}

/** 状态 pill：保持横向结构，避免覆盖 data-i18n 后布局错乱 */
function setLivePill(ok) {
  const el = document.getElementById("livePill");
  if (!el) return;
  const label = ok ? L().live : L().connErr;
  el.classList.toggle("is-err", !ok);
  el.innerHTML = ok
    ? `<span class="pulse" aria-hidden="true"></span><span class="live-text">${escapeHtml(label)}</span>`
    : `<span class="pulse" aria-hidden="true" style="background:var(--red);box-shadow:none"></span><span class="live-text">${escapeHtml(label)}</span>`;
}

function renderHealth(h) {
  const body = document.getElementById("hbody");
  if (!body || !h) return;
  if (!h.sources || !h.sources.length) {
    body.innerHTML = `<div class="empty">${escapeHtml(L().noSource)}</div>`;
    return;
  }
  body.innerHTML =
    h.sources
      .map(
        (s, i) => `
      <div class="h-row" style="animation-delay:${i * 0.05}s">
        <span class="dot ${s.status === "ok" ? "ok" : "err"}"></span>
        <span class="h-name">${escapeHtml(sourceLabel(s.source))}</span>
        <span class="h-age">${fmtAge(s.age_seconds)}</span>
      </div>`,
      )
      .join("") +
    `
      <div class="h-total">
        <span>库内事件总量</span>
        <b>${h.event_total ?? 0}</b>
      </div>`;
  const tick = document.getElementById("healthTick");
  if (tick) {
    tick.textContent =
      "已更新 " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }
}

function applyFeatures(all) {
  const wantN = document.getElementById("f-natural")?.checked !== false;
  const wantC = document.getElementById("f-conflict")?.checked !== false;

  let feats = all.filter((f) => {
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

  // 右侧面板与巡览默认：一律按发生时间新→旧
  feats = [...feats].sort(byTimeDesc);

  // 本地专题：本地事件置顶，组内仍按时间
  if (currentView === "local") {
    feats = [...feats].sort((a, b) => {
      const al = inLocal(a.geometry.coordinates[0], a.geometry.coordinates[1]) ? 0 : 1;
      const bl = inLocal(b.geometry.coordinates[0], b.geometry.coordinates[1]) ? 0 : 1;
      if (al !== bl) return al - bl;
      return byTimeDesc(a, b);
    });
  }

  const nNat = all.filter((f) => f.properties.category === "natural").length;
  const nCon = all.filter((f) => f.properties.category === "conflict").length;
  const nHi = all.filter((f) => Number(f.properties.severity) >= 0.7).length;
  document.getElementById("st-total").textContent = all.length;
  document.getElementById("st-nat").textContent = nNat;
  document.getElementById("st-con").textContent = nCon;
  document.getElementById("st-hi").textContent = nHi;
  document.getElementById("cnt-nat").textContent = nNat;
  document.getElementById("cnt-con").textContent = nCon;

  // 各类型数量角标（全量，便于对照筛选）
  const typeCounts = {};
  for (const it of FILTERABLE_TYPES) typeCounts[it.type] = 0;
  for (const f of all) {
    const t = f.properties && f.properties.type;
    if (t && typeCounts[t] != null) typeCounts[t] += 1;
  }
  for (const it of FILTERABLE_TYPES) {
    const cntEl = document.getElementById(`cnt-type-${it.type}`);
    if (cntEl) cntEl.textContent = String(typeCounts[it.type] || 0);
  }

  // is_live + marker_color（地图点色与列表/等级完全一致）
  const enriched = feats.map((f) => {
    const live = isLiveEvent(f.properties);
    const p = f.properties;
    const mc = mapMarkerColor(p);
    return {
      ...f,
      properties: {
        ...p,
        is_live: live ? 1 : 0,
        confidence: Number(p.confidence) || 1,
        severity: Number(p.severity) || 0,
        marker_color: mc,
      },
    };
  });
  lastEnrichedPoints = enriched.filter(
    (f) => f.geometry && f.geometry.type === "Point" && f.geometry.coordinates,
  );

  // 仅清理已彻底不在全量列表中的计时（筛选隐藏不重置，避免反复闪）
  for (const id of [...blinkStartedAt.keys()]) {
    if (!lastFeatures.some((f) => f.properties.id === id)) {
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

  if (mapReady && map.getSource("events")) {
    map
      .getSource("events")
      .setData({ type: "FeatureCollection", features: [...enriched, ...extra] });
  }

  // 特效层：地震圈 / 台风轨迹始终重建；洪水方向随 zoom/聚焦显示
  refreshEffectsFocus(effectsFocusId != null ? effectsFocusId : tourActiveId);

  const liveCount = enriched.filter((f) => f.properties.is_live === 1).length;

  // 巡览列表：默认时间序；若已锁定区域则仅该国/就近范围 + 时间序
  rebuildTourList(lastEnrichedPoints);
  renderFeed(tourList.slice(0, 60), liveCount);
}

function buildPopupHtml(p) {
  const live = Number(p.is_live) === 1;
  const grade = realGrade(p);
  const typeC = typeTextColor(p);
  const brief = buildBrief(p);
  const mag =
    p.magnitude != null && p.magnitude !== "null" ? `${p.magnitude} ${unitLabel(p.unit)}` : "—";
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
  } else if (p.type === "flood" || p.type === "landslide" || p.type === "debris_flow") {
    const brg = floodBearingDeg(p);
    extraRows = `
        <dt>监测点</dt><dd>${escapeHtml(fmtCoord(lat, lon))}</dd>
        <dt>示意流向</dt><dd>方位角约 ${brg}°（放大或预览后可见箭头）</dd>
        <dt>发生/更新</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
  } else if (p.type === "war" || p.type === "crisis_signal" || p.type === "armed_clash") {
    extraRows = `
        <dt>区域</dt><dd>${escapeHtml(countryLabel(p.country))}</dd>
        <dt>冲突级别</dt><dd>国家/代理人/边境武装级（已过滤普通枪击）</dd>
        <dt>时间窗</dt><dd>${fmtTime(p.occurred_at)}</dd>`;
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
  if (tourPopup) {
    try {
      tourPopup.remove();
    } catch (_) {}
    tourPopup = null;
  }
  // 同时清掉用户点击产生的其它弹窗
  document.querySelectorAll(".maplibregl-popup").forEach((el) => el.remove());
}

function showEventPopup(p, lngLat) {
  const lon = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng;
  const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat;
  const props = { ...p, _lon: lon, _lat: lat };
  closeTourPopup();
  tourPopup = new maplibregl.Popup({
    closeButton: true,
    maxWidth: "360px",
    offset: 16,
    anchor: "bottom",
    focusAfterOpen: false,
  })
    .setLngLat([lon, lat])
    .setHTML(buildPopupHtml(props))
    .addTo(map);
  tourActiveId = p.id;
  highlightTourItem(p.id);
  refreshEffectsFocus(p.id);
  startEqWavePulse(p.id);
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
  if (!tourList.length) {
    el.textContent =
      tourScope === "region"
        ? `区域无事件（${tourFocus?.name || countryLabel(tourFocus?.country) || "已锁定"}）`
        : "";
    return;
  }
  const scopeLabel =
    tourScope === "region"
      ? tourFocus?.name || countryLabel(tourFocus?.country) || "区域"
      : "时间序";
  if (tourIndex < 0) {
    el.textContent = `${scopeLabel} · 共 ${tourList.length} 处`;
  } else {
    el.textContent = `${scopeLabel} · ${tourIndex + 1} / ${tourList.length}`;
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
  if (t === "flood") return 7.2;
  if (t === "crisis_signal" || t === "armed_clash") return 5.2;
  return 6.5;
}

function flyPromise(opts) {
  return new Promise((resolve) => {
    if (!mapReady) {
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
  if (!mapReady) return;
  if (tourFlying) return;

  // 首次空格：确保时间序巡览列表
  if (!tourMode && tourScope === "time") {
    rebuildTourList(lastEnrichedPoints);
  }

  if (!tourList.length) {
    const tip =
      tourScope === "region"
        ? `「${tourFocus?.name || countryLabel(tourFocus?.country) || "该区域"}」在当前时段没有灾害事件`
        : "当前筛选下没有可巡览的灾害事件";
    showToast("空格巡览", tip);
    return;
  }

  // 第一次从 0 开始（最新），之后按时间往更旧循环
  if (tourIndex < 0) tourIndex = 0;
  else tourIndex = (tourIndex + 1) % tourList.length;

  const f = tourList[tourIndex];
  if (!f || !f.geometry || !f.geometry.coordinates) return;
  const [lon, lat] = f.geometry.coordinates;
  const targetZoom = zoomForEvent(f);

  tourFlying = true;
  tourMode = true;
  tourActiveId = f.properties.id;
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
    tourFlying = false;
    updateTourProgress();
  }
}

function renderFeed(feats, liveCount) {
  const box = document.getElementById("fbody");
  const liveHint = liveCount > 0 ? ` · ${L().liveCount(liveCount)}` : "";
  const scopeHint =
    tourScope === "region"
      ? ` · ${tourFocus?.name || countryLabel(tourFocus?.country) || (uiLang === "en" ? "Region" : "区域")}`
      : ` · ${L().latest}`;
  document.getElementById("feedCount").textContent =
    `${L().items(feats.length)}${scopeHint}${liveHint}`;
  if (!feats.length) {
    box.innerHTML = `<div class="empty">${escapeHtml(L().emptyEvents)}</div>`;
    return;
  }
  // 时间新→旧（tourList 已排序）
  const sorted = feats;
  box.innerHTML = sorted
    .map((f, i) => {
      const p = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      const live = Number(p.is_live) === 1;
      const active = tourActiveId != null && p.id === tourActiveId;
      const localBadge =
        currentView === "local" && inLocal(lon, lat)
          ? `<span style="color:var(--cyan)">· ${uiLang === "en" ? "Local" : "本地"}</span>`
          : "";
      const liveBadge = live
        ? `<span class="live-badge"><i></i>${uiLang === "en" ? "Live" : "进行中"}</span>`
        : "";
      const tc = typeColor(p.type);
      const grade = realGrade(p);
      const typeStyle = typeTextStyle(p);
      return `
      <div class="item ${p.category}${live ? " live" : ""}${active ? " tour-active" : ""}"
           data-id="${p.id}"
           style="animation-delay:${Math.min(i, 12) * 0.04}s;--type-color:${tc}"
           onclick="tourJumpToId(${JSON.stringify(p.id)})">
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

/** 预览聚焦时地震波：填充呼吸 + 外扩冲击波环 */
let _eqWaveTimer = null;
function startEqWavePulse(focusId) {
  if (_eqWaveTimer) {
    cancelAnimationFrame(_eqWaveTimer);
    _eqWaveTimer = null;
  }
  _eqWaveExtras = [];
  if (!mapReady || !map.getLayer("fx-eq-fill")) return;

  const feat =
    focusId != null
      ? lastEnrichedPoints.find((f) => String(f.properties.id) === String(focusId))
      : null;
  const isEq = feat && feat.properties && feat.properties.type === "earthquake";
  const lon = isEq ? feat.geometry.coordinates[0] : null;
  const lat = isEq ? feat.geometry.coordinates[1] : null;
  const maxR = isEq ? eqImpactRadiusKm(feat.properties.magnitude) : 0;
  const color = isEq
    ? feat.properties.marker_color || mapMarkerColor(feat.properties)
    : "#f0b429";

  const tick = (ts) => {
    if (!mapReady || !map.getLayer("fx-eq-fill")) return;
    const s = 0.5 + 0.5 * Math.sin(((ts / 1000) * Math.PI * 2) / 1.8);
    try {
      map.setPaintProperty("fx-eq-fill", "fill-opacity", [
        "case",
        ["==", ["get", "focused"], 1],
        [
          "case",
          ["==", ["get", "ring"], "inner"],
          0.12 + s * 0.22,
          0.05 + s * 0.14,
        ],
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
        [
          "case",
          ["==", ["get", "focused"], 1],
          0.45 + s * 0.5,
          0.55,
        ],
      ]);
      map.setPaintProperty("fx-eq-line", "line-width", [
        "case",
        ["==", ["get", "ring"], "wave"],
        2.2,
        [
          "case",
          ["==", ["get", "ring"], "inner"],
          1.6,
          1.1,
        ],
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
      _eqWaveExtras = [
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
        const base = buildEffectFeatures(lastEnrichedPoints, focusId);
        if (map.getSource("effects")) {
          map.getSource("effects").setData({
            type: "FeatureCollection",
            features: base.concat(_eqWaveExtras),
          });
        }
      }
    }

    _eqWaveTimer = requestAnimationFrame(tick);
  };
  _eqWaveTimer = requestAnimationFrame(tick);
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
  const all = lastEnrichedPoints;
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
  const idx = tourList.findIndex((x) => String(x.properties.id) === String(id));
  if (idx < 0) {
    showToast("区域巡览", "该事件不在可巡览列表中");
    return;
  }
  tourIndex = idx - 1;
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
    tourIndex = -1;
    tourActiveId = null;
    highlightTourItem(null);
    renderFeed(tourList.slice(0, 60), tourList.filter((x) => x.properties.is_live).length);
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
  tourIndex = -1;
  tourActiveId = null;
  highlightTourItem(null);
  renderFeed(tourList.slice(0, 60), tourList.filter((x) => x.properties.is_live).length);
}

/** 退出空格预览模式（Esc）→ 回到全局时间序 */
async function exitTourMode() {
  if (!tourMode && tourIndex < 0 && !tourPopup && tourScope === "time") {
    closeTourPopup();
    return;
  }
  if (tourFlying) {
    try {
      map.stop();
    } catch (_) {}
  }
  tourFlying = false;
  tourMode = false;
  tourIndex = -1;
  tourActiveId = null;
  tourScope = "time";
  tourFocus = null;
  closeTourPopup();
  highlightTourItem(null);
  if (_eqWaveTimer) {
    cancelAnimationFrame(_eqWaveTimer);
    _eqWaveTimer = null;
  }
  _eqWaveExtras = [];
  refreshEffectsFocus(null);
  rebuildTourList(lastEnrichedPoints);
  renderFeed(tourList.slice(0, 60), tourList.filter((x) => x.properties.is_live).length);
  updateTourProgress();

  // 回到总览视距（平面 / 地球仪各自合适缩放）
  const overviewZoom =
    mapMode === "globe"
      ? currentView === "local"
        ? 2.3
        : 1.35
      : currentView === "local"
        ? 3.4
        : 1.55;
  const center = currentView === "local" ? LOCAL_CENTER : [20, 25];
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

// 空格：巡览；Esc：退出预览
window.addEventListener(
  "keydown",
  (e) => {
    const tag = (e.target && e.target.tagName) || "";
    const typing =
      tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable;

    if (e.code === "Escape" || e.key === "Escape") {
      e.preventDefault();
      exitTourMode();
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
    setPanelsCollapsed(!panelsCollapsed, { toast: false });
  });
}

// 界面语言 + 地图地名
document.querySelectorAll("[data-lang]").forEach((btn) => {
  btn.addEventListener("click", () => applyUiLang(btn.dataset.lang, { toast: true }));
});
// 先恢复面板折叠态，再套语言（会刷新按钮文案）
setPanelsCollapsed(panelsCollapsed, { persist: false });
applyUiLang(uiLang, { toast: false });

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

function showToast(title, text) {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<div class="th">${escapeHtml(title)}</div><div class="tb">${escapeHtml(text)}</div>`;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 400);
  }, 5200);
}

function connectWS() {
  try {
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/alerts`,
    );
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        const tip = d.headline
          ? eventHeadline({
              headline: d.headline,
              type: d.type,
              country: d.country,
              magnitude: d.magnitude ?? d.magnitude_value,
            })
          : d.rule || L().alertPush;
        showToast(L().newAlert, tip);
      } catch {
        showToast(L().newAlert, L().alertPush);
      }
      refresh();
      loadHealth();
    };
    ws.onclose = () => setTimeout(connectWS, 5000);
  } catch {
    setTimeout(connectWS, 5000);
  }
}

["f-natural", "f-conflict", "hours"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    // 大类关闭时：不改类型勾选状态，仅从地图/列表隐藏；重新打开仍尊重类型开关
    if (id === "hours") return;
    applyFeatures(lastFeatures);
  });
});
document.getElementById("hours").addEventListener("change", refresh);

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
window.tourJumpToId = tourJumpToId;
window.flyTo = flyTo;
window.tourNextEvent = tourNextEvent;
window.exitTourMode = exitTourMode;
