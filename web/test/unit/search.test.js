import { describe, expect, it } from "vite-plus/test";
import { parseSearchQuery, matchSearchRecord } from "../../src/event-search.js";

// 与 pipeline.searchRecordOf 的产出形状一致（全部小写 blob）
const rec = (o) => ({
  blob: "东京以东 100 公里 · 地震\nearthquake 地震\njpn 日本 japan\nusgs 美国地质调查局\nnatural 自然灾害\n6.1 m",
  type: "earthquake 地震 earthquake",
  country: "jpn 日本 japan tokyo 东京",
  source: "usgs 美国地质调查局 usgs",
  cat: "natural 自然灾害 natural disaster",
  headline: "东京以东 100 公里 · 地震",
  mag: 6.1,
  sev: 0.6,
  lon: 139.7,
  lat: 35.7,
  ...o,
});

describe("event-search", () => {
  it("space = AND, OR = OR, -term excludes", () => {
    expect(matchSearchRecord(rec(), parseSearchQuery("日本 地震"))).toBe(true);
    expect(matchSearchRecord(rec(), parseSearchQuery("日本 洪水"))).toBe(false);
    expect(matchSearchRecord(rec(), parseSearchQuery("洪水 OR 地震"))).toBe(true);
    expect(matchSearchRecord(rec(), parseSearchQuery("日本 -地震"))).toBe(false);
  });
  it("field filters: 类型/国家/来源/震级", () => {
    expect(matchSearchRecord(rec(), parseSearchQuery("类型:earthquake"))).toBe(true);
    expect(matchSearchRecord(rec(), parseSearchQuery("类型:flood"))).toBe(false);
    expect(matchSearchRecord(rec(), parseSearchQuery("国家:jpn"))).toBe(true);
    expect(matchSearchRecord(rec(), parseSearchQuery("国家:日本"))).toBe(true);
    expect(matchSearchRecord(rec(), parseSearchQuery("震级:>=5"))).toBe(true);
    expect(matchSearchRecord(rec(), parseSearchQuery("震级:>=7"))).toBe(false);
  });
  it("empty query matches everything", () => {
    expect(parseSearchQuery("")).toBeNull();
  });
});
