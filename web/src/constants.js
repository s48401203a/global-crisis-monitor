/** 跨模块共享的常量与集合。 */
const LOCAL_BOUNDS = [
  [73, 18],
  [135, 54],
]; // 中国大致范围
const LOCAL_CENTER = [104.5, 35.0];
const TYPE_COLORS = {
  earthquake: "#c9a227", // 默认琥珀金 · 小震
  cyclone: "#5b8def", // 天蓝 · 气旋
  flood: "#2bb0ed", // 亮青蓝 · 洪水
  rainstorm: "#38bdf8", // 雨青 · 暴雨预警
  wildfire: "#ff5c33", // 焰橙 · 野火
  volcano: "#d946ef", // 品红 · 火山
  drought: "#a78b4a", // 枯沙 · 干旱
  crisis_signal: "#f472b6", // 粉红 · 危机信号
  armed_clash: "#ef4444", // 正红 · 武装冲突
  war: "#b91c1c", // 暗红 · 战争冲突（历史遗留类型）
  theater: "#b91c1c", // 暗红 · 战区基线层
};
const TYPE_COLOR_DEFAULT = "#94a3b8";
const EQ_COLOR_M5 = "#f0b429"; // 震级≥5 黄
const EQ_COLOR_M7 = "#e11d48"; // 震级≥7 红
const FILTERABLE_TYPES = [
  { type: "earthquake", category: "natural" },
  { type: "cyclone", category: "natural" },
  { type: "flood", category: "natural" },
  { type: "rainstorm", category: "natural" },
  { type: "wildfire", category: "natural" },
  { type: "volcano", category: "natural" },
  { type: "drought", category: "natural" },
  { type: "armed_clash", category: "conflict" },
  { type: "crisis_signal", category: "conflict" },
  { type: "theater", category: "conflict", layer: true }, // 战区基线：独立图层，不计入统计
];
const LIVE_WINDOW_MS = 30 * 60 * 1000;
const BLINK_DURATION_MS = 2 * 60 * 1000;
const BREAKING_BLINK_MS = 3 * 60 * 1000;
const STARTUP_BREAKING_MS = 15 * 60 * 1000;
const blinkStartedAt = new Map();
const breakingBlinkUntil = new Map();
const seenEventIds = new Set();
const breakingQueue = [];
const breakingQueued = new Set();
const featureStore = new Map(); // id → Feature
const TIME_RANGE_HOURS = {
  day: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 3600000));
  },
  week: () => 24 * 7,
  month: () => 24 * 30,
  half: () => 24 * 183,
  year: () => 24 * 365,
};

export {
  LOCAL_BOUNDS,
  LOCAL_CENTER,
  TYPE_COLORS,
  TYPE_COLOR_DEFAULT,
  EQ_COLOR_M5,
  EQ_COLOR_M7,
  FILTERABLE_TYPES,
  LIVE_WINDOW_MS,
  BLINK_DURATION_MS,
  BREAKING_BLINK_MS,
  STARTUP_BREAKING_MS,
  blinkStartedAt,
  breakingBlinkUntil,
  seenEventIds,
  breakingQueue,
  breakingQueued,
  featureStore,
  TIME_RANGE_HOURS,
};
