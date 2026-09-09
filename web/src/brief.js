/** 一句话简报（列表与弹窗共用）。 */
import { countryLabel, isCmaAlert, parseMetrics, realGrade, typeLabel } from "./grade.js";
import { getLang } from "./i18n/index.js";
import { fmtCoord, fmtNum, fmtTime } from "./util/format.js";
import { eqImpactRadiusKm, parseFootprint } from "./util/geo.js";

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
  const en = getLang() === "en";

  if (t === "earthquake") {
    const r = eqImpactRadiusKm(mag);
    const magTxt =
      mag != null && Number.isFinite(mag) ? `M${mag.toFixed(1)}` : en ? "mag. n/a" : "震级待定";
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
    const wind =
      mag != null
        ? en
          ? `winds ~ ${fmtNum(mag)} kts, `
          : `中心附近风速约 ${fmtNum(mag)} 节，`
        : "";
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
    const area =
      mag != null ? (en ? `~ ${fmtNum(mag)} acres, ` : `过火约 ${fmtNum(mag)} 英亩，`) : "";
    return en
      ? `${when} ${place} wildfire: ${area}${grade.text}.`
      : `${when} ${place} 野火：${area}${grade.text}。点位为当前目录记录位置。`;
  }

  if (t === "rainstorm") {
    return en
      ? `${when} ${place} rainstorm warning: ${grade.text}. Official CMA alert, not a measured river flood.`
      : `${when} ${place} 气象暴雨预警：${grade.text}。这是中央气象台预警信号，不是实测河道洪水。`;
  }

  if (t === "flood" || t === "landslide" || t === "debris_flow") {
    if (isCmaAlert(p)) {
      return en
        ? `${when} ${place} flood-risk warning: ${grade.text}. Meteorological/hydrology alert.`
        : `${when} ${place} 山洪/洪水气象风险预警：${grade.text}。`;
    }
    const kind =
      t === "flood" ? (en ? "Flood" : "洪水") : en ? "Landslide/debris flow" : "泥石流/滑坡";
    const flow =
      mag != null && t === "flood"
        ? en
          ? `discharge ~ ${fmtNum(mag)} m³/s, `
          : `监测径流量约 ${fmtNum(mag)} m³/s，`
        : "";
    return en
      ? `${when} ${place} ${kind}: ${flow}${grade.text}.`
      : `${when} ${place} ${kind}：${flow}${grade.text}。`;
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
    const isAgg = met.aggregate === true || met.aggregate === "true" || p.is_aggregate;
    const slot = met.latest_slot_count;
    const nTxt =
      n != null
        ? isAgg
          ? en
            ? `${fmtNum(n)} signals today${slot != null ? ` (${fmtNum(slot)} in last 15 min)` : ""}, `
            : `当日累计 ${fmtNum(n)} 起信号${slot != null ? `（最近 15 分钟 ${fmtNum(slot)} 起）` : ""}，`
          : en
            ? `${fmtNum(n)} signals in window, `
            : `近窗聚合 ${fmtNum(n)} 起信号，`
        : "";
    return en
      ? `${when} ${place} ${kind}: ${nTxt}${grade.text}. Country-level aggregate from GDELT; not a confirmed incident.`
      : `${when} ${place} ${kind}：${nTxt}${grade.text}。GDELT 国家级聚合信号，非确证事件，坐标为国家示意位置。`;
  }

  return en
    ? `${when} ${place} ${typeLabel(t)}: ${grade.text}.`
    : `${when} ${place} ${typeLabel(t)}：${grade.text}。`;
}

export { buildBrief };
