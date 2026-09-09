/** MapLibre 地图实例与底图源（卫星/地形/注记）。 */
import maplibregl from "maplibre-gl";

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
        paint: { "background-color": "#07091c" },
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
  localIdeographFontFamily:
    "'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Source Han Sans SC', sans-serif",
  attributionControl: true,
  renderWorldCopies: false,
  fadeDuration: 200,
  // 形态过渡要抓一帧画布盖住投影硬切
  preserveDrawingBuffer: true,
  maxTileCacheSize: 120,
  // 静态底图（Esri/OpenTopoMap）不刷新过期瓦片，避免视野回到已加载区域时重复请求
  refreshExpiredTiles: false,
  prefetchZoomDelta: 4,
});

export { SURFACE_TILES, map };
