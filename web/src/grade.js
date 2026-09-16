/** 分级（服务端 grade 优先）、CMA 等级解析、类型/来源/国家标签与颜色（纯函数）。 */
import { EQ_COLOR_M5, EQ_COLOR_M7, TYPE_COLORS, TYPE_COLOR_DEFAULT } from "./constants.js";
import { L, getLang } from "./i18n/index.js";
import { escapeHtml, fmtNum } from "./util/format.js";

/** 地图标记色 = 列表/等级色（地震按震级，其它按类型） */
function mapMarkerColor(p) {
  if (!p) return TYPE_COLOR_DEFAULT;
  if (p.type === "earthquake") return typeTextColor(p);
  return typeColor(p.type);
}

function isCmaAlert(p) {
  if (!p) return false;
  if (p.source === "cma" || p.unit === "alert") return true;
  const met = parseMetrics(p);
  return Boolean(met.cma_level || met.cma_alertscore);
}

function cmaAlertBlob(p) {
  const met = parseMetrics(p);
  return `${p?.headline || ""} ${met.cma_headline || ""}`;
}

function parseCmaLevelFromText(text) {
  const t = String(text || "");
  if (/红色预警|红预警/.test(t)) return "红";
  if (/橙色预警|橙预警/.test(t)) return "橙";
  if (/黄色预警|黄预警/.test(t)) return "黄";
  if (/蓝色预警|蓝预警/.test(t)) return "蓝";
  return null;
}

function cmaSignalLevel(p) {
  return parseCmaLevelFromText(cmaAlertBlob(p)) || parseMetrics(p).cma_level || null;
}

function officialAlertTone(p) {
  const met = parseMetrics(p);
  const raw = met.gdacs_alert || met.usgs_alert;
  if (raw) {
    const k = String(raw).toLowerCase();
    if (["green", "yellow", "orange", "red"].includes(k)) return k;
  }
  const lv = cmaSignalLevel(p);
  if (lv === "红") return "red";
  if (lv === "橙") return "orange";
  if (lv === "黄") return "yellow";
  if (lv === "蓝") return "green";
  return null;
}

function isMinorCmaAlert(p) {
  const lv = cmaSignalLevel(p);
  return lv === "蓝" || lv === "黄";
}

function remapCmaDisplayType(p) {
  if (!p || !isCmaAlert(p)) return p?.type;
  const blob = cmaAlertBlob(p);
  if (/台风|热带风暴|热带低压|风暴潮/.test(blob)) return "cyclone";
  if (/山洪|洪水/.test(blob)) return "flood";
  if (/暴雨|强降雨|地质灾害/.test(blob)) return "rainstorm";
  if (/森林火|草原火/.test(blob)) return "wildfire";
  if (/干旱/.test(blob)) return "drought";
  return p.type;
}

function normalizeEventFeature(f) {
  const p = (f && f.properties) || {};
  const type = remapCmaDisplayType(p) || p.type;
  const lv = cmaSignalLevel(p);
  const met = { ...parseMetrics(p) };
  if (lv && met.cma_level !== lv) met.cma_level = lv;
  return {
    ...f,
    properties: { ...p, type, metrics: met },
  };
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
    p.magnitude != null && p.magnitude !== "" && p.magnitude !== "null" ? Number(p.magnitude) : NaN;
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
  if (getLang() === "en") return ISO3_EN[code] || code;
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

/**
 * 真实灾害等级（来自数据源物理量 / 官方警报，而非仅 0~1 severity）
 * 返回 { text, tone } tone: green|yellow|orange|red|neutral
 */
function realGrade(p) {
  // 服务端已统一分级（/api/events grade 字段）；本地实现仅作夹具/旧数据兜底
  const g = p && p.grade;
  if (g && typeof g === "object" && g.tone) {
    return { text: getLang() === "en" ? g.en || g.zh || "" : g.zh || g.en || "", tone: g.tone };
  }
  const t = p.type;
  const met = parseMetrics(p);
  const mag =
    p.magnitude != null && p.magnitude !== "" && p.magnitude !== "null"
      ? Number(p.magnitude)
      : null;
  const alertTone = officialAlertTone(p);
  const alertKey = alertTone || "";

  // 官方警报色（GDACS / USGS / 中央气象台）
  const en = getLang() === "en";
  const alertZh = en
    ? { green: "Green", yellow: "Yellow", orange: "Orange", red: "Red" }
    : { green: "绿色", yellow: "黄色", orange: "橙色", red: "红色" };

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
      return {
        text: `${alertPart}${band} ${fmtNum(mag)} ${en ? "acres" : "英亩"}`,
        tone: alertTone || tone,
      };
    }
    if (alertTone)
      return {
        text: en ? `${alertZh[alertKey]} alert · wildfire` : `${alertZh[alertKey]}警报 · 野火`,
        tone: alertTone,
      };
    return { text: en ? "Burn area n/a" : "火场规模未定", tone: "neutral" };
  }

  if (t === "rainstorm") {
    if (alertTone) {
      return {
        text: en ? `${alertZh[alertKey]} rainstorm warning` : `${alertZh[alertKey]}暴雨预警`,
        tone: alertTone,
      };
    }
    return { text: en ? "Rainstorm warning" : "暴雨预警", tone: "orange" };
  }

  if (t === "flood") {
    if (isCmaAlert(p) && alertTone) {
      return {
        text: en
          ? `${alertZh[alertKey]} flood-risk warning`
          : `${alertZh[alertKey]}山洪/洪水风险预警`,
        tone: alertTone,
      };
    }
    if (alertTone) {
      return {
        text:
          mag != null && Number.isFinite(mag) && p.unit !== "alert"
            ? en
              ? `${alertZh[alertKey]} alert · discharge ${fmtNum(mag)} m³/s`
              : `${alertZh[alertKey]}警报 · 径流 ${fmtNum(mag)} m³/s`
            : en
              ? `${alertZh[alertKey]} alert · flood`
              : `${alertZh[alertKey]}警报 · 洪水`,
        tone: alertTone,
      };
    }
    if (mag != null && Number.isFinite(mag) && p.unit !== "alert") {
      return {
        text: en ? `Discharge ${fmtNum(mag)} m³/s` : `径流量 ${fmtNum(mag)} m³/s`,
        tone: "yellow",
      };
    }
    return { text: en ? "Flood grade n/a" : "洪水等级未定", tone: "neutral" };
  }

  if (t === "volcano") {
    if (alertTone)
      return {
        text: en ? `${alertZh[alertKey]} alert · volcano` : `${alertZh[alertKey]}警报 · 火山活动`,
        tone: alertTone,
      };
    return {
      text:
        mag != null
          ? en
            ? `Volcano ${fmtNum(mag)}`
            : `火山活动 ${fmtNum(mag)}`
          : en
            ? "Volcano activity"
            : "火山活动",
      tone: "orange",
    };
  }

  if (t === "drought") {
    if (alertTone)
      return {
        text: en ? `${alertZh[alertKey]} alert · drought` : `${alertZh[alertKey]}警报 · 干旱`,
        tone: alertTone,
      };
    return { text: en ? "Drought alert" : "干旱预警", tone: "yellow" };
  }

  if (t === "war") {
    const level = met.war_level || (mag != null && mag >= 2.5 ? "high" : "medium");
    if (level === "high")
      return {
        text: en ? "High-intensity war zone / ongoing conflict" : "高强度战区 / 持续冲突",
        tone: "red",
      };
    if (level === "medium")
      return { text: en ? "Medium-intensity conflict zone" : "中等强度冲突关注区", tone: "orange" };
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
    const unit = p.unit === "events" ? (en ? "events" : "起事件") : en ? "articles" : "篇报道";
    return { text: `${band} · ${fmtNum(arts)} ${unit}`, tone };
  }

  if (alertTone)
    return {
      text: en ? `${alertZh[alertKey]} alert` : `${alertZh[alertKey]}警报`,
      tone: alertTone,
    };
  if (mag != null && Number.isFinite(mag)) {
    return { text: `${fmtNum(mag)} ${unitLabel(p.unit) || ""}`.trim(), tone: "neutral" };
  }
  return { text: en ? "Grade n/a" : "等级待定", tone: "neutral" };
}

function gradeBadgeHtml(p) {
  const g = realGrade(p);
  return `<span class="grade-badge g-${g.tone}">${escapeHtml(g.text)}</span>`;
}

export {
  ISO3_ZH,
  ISO3_EN,
  countryLabel,
  loadIso3Zh,
  parseMetrics,
  realGrade,
  gradeBadgeHtml,
  officialAlertTone,
  isCmaAlert,
  cmaAlertBlob,
  parseCmaLevelFromText,
  cmaSignalLevel,
  isMinorCmaAlert,
  remapCmaDisplayType,
  normalizeEventFeature,
  typeLabel,
  catLabel,
  sourceLabel,
  unitLabel,
  typeColor,
  typeTextColor,
  typeTextStyle,
  mapMarkerColor,
};
