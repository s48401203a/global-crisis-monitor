import { describe, expect, it } from "vite-plus/test";
import {
  parseCmaLevelFromText,
  officialAlertTone,
  isMinorCmaAlert,
  realGrade,
  normalizeEventFeature,
} from "../../src/grade.js";

describe("grade (client)", () => {
  it("CMA level parsing only matches 预警 wording", () => {
    expect(parseCmaLevelFromText("广西北海市发布暴雨橙色预警")).toBe("橙");
    expect(parseCmaLevelFromText("黄山市天气")).toBeNull();
  });
  it("official tone from gdacs/usgs/cma", () => {
    expect(officialAlertTone({ metrics: { gdacs_alert: "Red" } })).toBe("red");
    expect(officialAlertTone({ headline: "暴雨黄色预警", metrics: {} })).toBe("yellow");
    expect(isMinorCmaAlert({ headline: "暴雨蓝色预警" })).toBe(true);
  });
  it("prefers server grade when present", () => {
    const g = realGrade({
      type: "earthquake",
      magnitude: 6,
      grade: { band: "strong", tone: "yellow", zh: "强震 M6.0", en: "Strong M6.0" },
    });
    expect(g).toEqual({ text: "强震 M6.0", tone: "yellow" });
  });
  it("falls back to local grading without server grade", () => {
    const g = realGrade({ type: "earthquake", magnitude: 7.5 });
    expect(g.tone).toBe("red");
  });
  it("normalizeEventFeature keeps metrics object and remaps CMA type", () => {
    const f = normalizeEventFeature({
      properties: {
        type: "flood",
        source: "cma",
        unit: "alert",
        headline: "暴雨橙色预警",
        metrics: "{}",
      },
    });
    expect(typeof f.properties.metrics).toBe("object");
  });
});
