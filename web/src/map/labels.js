/** 地图地名：中英文注记、省市城市点、语言切换。 */
import { ISO3_EN } from "../grade.js";
import { getLang } from "../i18n/index.js";
import { map } from "./instance.js";
import { applyFeatures } from "../pipeline.js";
import { getCityLabelCollection, registerExtraPlaces } from "../region-gazetteer.js";
import { state } from "../state.js";

/** 按界面语言返回地图地名 text-field 表达式（单语，不叠双行） */
function placeLabelTextField() {
  // 中文界面 → name_zh；英文界面 → name_en（缺省回退中文）
  if (getLang() === "en") {
    return ["coalesce", ["get", "name_en"], ["get", "name_zh"], ""];
  }
  return ["coalesce", ["get", "name_zh"], ["get", "name_en"], ""];
}

/** 切换地图地名语言（与 UI 语言一致） */
function applyPlaceLabelLang() {
  if (!map) return;
  const field = placeLabelTextField();
  for (const id of [
    "label-continent",
    "label-ocean",
    "label-country",
    "label-city",
    "label-cn-city",
  ]) {
    if (!map.getLayer(id)) continue;
    try {
      map.setLayoutProperty(id, "text-field", field);
    } catch (err) {
      console.warn("place label lang", id, err);
    }
  }
  // 中文界面关掉英文栅格注记，改用地图矢量中文城市名
  if (map.getLayer("surface-labels")) {
    try {
      map.setPaintProperty("surface-labels", "raster-opacity", getLang() === "en" ? 0.22 : 0);
    } catch (_) {}
  }
}

function ensureGazetteerCityLabels() {
  if (!map) return;
  const data = getCityLabelCollection();
  if (map.getSource("city-labels")) {
    map.getSource("city-labels").setData(data);
  } else {
    map.addSource("city-labels", { type: "geojson", data });
  }
  const halo = {
    "text-halo-color": "rgba(2, 8, 18, 0.9)",
    "text-halo-width": 1.35,
    "text-halo-blur": 0.35,
  };
  if (!map.getLayer("label-cn-city-dot")) {
    map.addLayer({
      id: "label-cn-city-dot",
      type: "circle",
      source: "city-labels",
      minzoom: 4.2,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4.5, 2, 8, 3.2, 12, 4],
        "circle-color": "rgba(255, 248, 230, 0.95)",
        "circle-stroke-color": "rgba(2, 8, 18, 0.75)",
        "circle-stroke-width": 1,
        "circle-opacity": 0.92,
      },
    });
  }
  if (!map.getLayer("label-cn-city")) {
    map.addLayer({
      id: "label-cn-city",
      type: "symbol",
      source: "city-labels",
      minzoom: 4.2,
      layout: {
        "text-field": placeLabelTextField(),
        "text-font": ["Noto Sans Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4.4,
          ["case", ["==", ["get", "rank"], 1], 11, 10],
          6.5,
          ["case", ["==", ["get", "rank"], 1], 13, 11.5],
          10,
          15,
        ],
        "text-anchor": "top",
        "text-offset": [0, 0.45],
        "text-padding": 2,
        "text-allow-overlap": false,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 9],
      },
      paint: {
        "text-color": "#fff6e4",
        "text-opacity": 0.96,
        ...halo,
      },
    });
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
      registerExtraPlaces(
        (fc.features || [])
          .filter((f) => f.properties && f.properties.kind === "city" && f.geometry)
          .map((f) => {
            const p = f.properties || {};
            const [lon, lat] = f.geometry.coordinates || [];
            return {
              label: p.name_zh || p.name_en,
              names: [p.name_zh, p.name_en, p.name_zh ? `${p.name_zh}市` : ""].filter(Boolean),
              lon,
              lat,
              radiusKm: 60,
            };
          }),
      );
      if (state.lastFeatures.length) applyFeatures(state.lastFeatures);
      ensureGazetteerCityLabels();
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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2.2, 8, 3.2, 12, 4],
          "circle-color": "rgba(255, 248, 230, 0.92)",
          "circle-stroke-color": "rgba(2, 8, 18, 0.75)",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      },
      "label-city",
    );
  }

  ensureGazetteerCityLabels();
  applyPlaceLabelLang();
}

export {
  placeLabelTextField,
  applyPlaceLabelLang,
  ensureGazetteerCityLabels,
  addBilingualPlaceLabels,
};
