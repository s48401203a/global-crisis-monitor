/** 几何工具：影响半径、圆多边形、方位点、footprint 解析（纯函数）。 */

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

/** 洪水/泥石流示意方向（无真实方位时用确定性伪方向，保证稳定） */
function floodBearingDeg(p) {
  const id = Number(p.id) || 0;
  // 0–360 稳定哈希，避免随机跳动
  return (id * 47 + Math.round((Number(p.magnitude) || 0) * 13)) % 360;
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

export { eqImpactRadiusKm, makeCirclePolygon, destPoint, floodBearingDeg, parseFootprint };
