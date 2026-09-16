/** 纯格式化与几何小工具（无 DOM/地图依赖，可单测）。 */
import { L } from "../i18n/index.js";

/** 经纬度一句话格式（南北纬/东西经） */
function fmtCoord(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "坐标待定";
  const ns = la >= 0 ? `${la.toFixed(2)}°N` : `${Math.abs(la).toFixed(2)}°S`;
  const ew = lo >= 0 ? `${lo.toFixed(2)}°E` : `${Math.abs(lo).toFixed(2)}°W`;
  return `${ns}, ${ew}`;
}

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  if (Math.abs(x) >= 10000) return Math.round(x).toLocaleString("zh-CN");
  if (Math.abs(x) >= 100) return x.toFixed(0);
  return (Math.round(x * 10) / 10).toString();
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

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { escapeHtml, fmtTime, fmtAge, fmtNum, fmtCoord, haversineKm, byTimeDesc };
