/** 地图特效几何：地震影响圈、台风轨迹、洪水方向；聚焦刷新。 */
import { isCmaAlert, mapMarkerColor } from "../grade.js";
import { state } from "../state.js";
import { map } from "./instance.js";
import {
  destPoint,
  eqImpactRadiusKm,
  floodBearingDeg,
  makeCirclePolygon,
  parseFootprint,
} from "../util/geo.js";

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

    // 洪水流向：只给实测径流；气象暴雨预警不画。
    if (shouldDrawFloodArrow(p)) {
      const sev = Number(p.severity) || 0;
      const brg = floodBearingDeg(p);
      const len = focused ? 16 : 9;
      const tip = destPoint(lon, lat, brg, len);
      const mid = destPoint(lon, lat, brg, len * 0.74);
      const wing = focused ? 3.2 : 2.1;
      const left = destPoint(mid[0], mid[1], brg + 150, wing);
      const right = destPoint(mid[0], mid[1], brg - 150, wing);
      out.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[lon, lat], tip] },
        properties: {
          effect: "flood_dir",
          parent_id: p.id,
          marker_color: color,
          focused,
          bearing: brg,
          sev,
          lon,
          lat,
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
          sev,
          lon,
          lat,
        },
      });
    }
  }
  return thinFloodDirFeatures(out);
}

function thinFloodDirFeatures(features) {
  const unfocused = [];
  const rest = [];
  for (const f of features) {
    if (f.properties?.effect === "flood_dir" && !f.properties.focused) unfocused.push(f);
    else rest.push(f);
  }
  if (!unfocused.length) return features;
  const byId = new Map();
  for (const f of unfocused) {
    const id = f.properties.parent_id;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(f);
  }
  const ranked = [...byId.entries()]
    .map(([id, feats]) => ({
      id,
      sev: Number(feats[0].properties.sev) || 0,
      lon: Number(feats[0].properties.lon),
      lat: Number(feats[0].properties.lat),
      feats,
    }))
    .sort((a, b) => b.sev - a.sev);
  const kept = [];
  const used = [];
  const cell = 2.4;
  for (const it of ranked) {
    if (kept.length >= 3) break;
    const gx = Math.round(it.lon / cell);
    const gy = Math.round(it.lat / cell);
    if (used.some(([x, y]) => x === gx && y === gy)) continue;
    used.push([gx, gy]);
    kept.push(it.id);
  }
  const keepIds = new Set(kept);
  return rest.concat(unfocused.filter((f) => keepIds.has(f.properties.parent_id)));
}

/**
 * 刷新特效层（地震影响圈全局、台风路径全局、洪水方向按 zoom/聚焦）
 * @param {string|number|null} focusId 当前弹窗/空格预览中的事件 id
 */
function refreshEffectsFocus(focusId) {
  state.effectsFocusId = focusId != null ? focusId : null;
  if (!state.mapReady || !map.getSource("effects")) return;
  const base = buildEffectFeatures(state.lastEnrichedPoints, state.effectsFocusId);
  const features = state._eqWaveExtras.length ? base.concat(state._eqWaveExtras) : base;
  map.getSource("effects").setData({ type: "FeatureCollection", features });
}

/** 仅实测径流/山洪画箭头；气象暴雨预警不画 */
function shouldDrawFloodArrow(p) {
  if (!p) return false;
  if (p.type !== "flood" && p.type !== "landslide" && p.type !== "debris_flow") return false;
  if (isCmaAlert(p) || p.unit === "alert") return false;
  const sev = Number(p.severity);
  const mag = Number(p.magnitude);
  if (Number.isFinite(sev) && sev < 0.78) return false;
  if (p.unit === "m3/s" && Number.isFinite(mag) && mag < 80) return false;
  return true;
}

export { shouldDrawFloodArrow, buildEffectFeatures, thinFloodDirFeatures, refreshEffectsFocus };
