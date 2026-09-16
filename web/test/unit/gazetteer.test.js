import { describe, expect, it } from "vite-plus/test";
import {
  findRegions,
  pointMatchesPlaceToken,
  primaryPlace,
  placeBounds,
} from "../../src/region-gazetteer.js";

describe("region-gazetteer", () => {
  it("finds provinces by Chinese name and abbreviation", () => {
    expect(findRegions("河南").length).toBeGreaterThan(0);
    expect(findRegions("豫").length).toBeGreaterThan(0);
    expect(findRegions("henan").length).toBeGreaterThan(0);
  });
  it("point in Henan matches 河南, point in Tokyo does not", () => {
    expect(pointMatchesPlaceToken(113.6, 34.7, "河南")).toBe(true);
    expect(pointMatchesPlaceToken(139.7, 35.7, "河南")).toBe(false);
  });
  it("primaryPlace resolves and has bounds", () => {
    const p = primaryPlace("杭州");
    expect(p).toBeTruthy();
    const b = placeBounds(p);
    expect(Array.isArray(b)).toBe(true);
  });
});
