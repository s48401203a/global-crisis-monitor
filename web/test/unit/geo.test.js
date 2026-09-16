import { describe, expect, it } from "vite-plus/test";
import {
  eqImpactRadiusKm,
  makeCirclePolygon,
  destPoint,
  parseFootprint,
} from "../../src/util/geo.js";

describe("geo", () => {
  it("impact radius grows with magnitude and is capped", () => {
    expect(eqImpactRadiusKm(1)).toBe(12);
    expect(eqImpactRadiusKm(5)).toBeGreaterThan(eqImpactRadiusKm(4));
    expect(eqImpactRadiusKm(9.5)).toBe(900);
  });
  it("circle polygon is closed and has steps+1 points", () => {
    const poly = makeCirclePolygon(0, 0, 100, 16);
    const ring = poly.coordinates[0];
    expect(ring.length).toBe(17);
    expect(ring[0][0]).toBeCloseTo(ring[16][0], 9);
    expect(ring[0][1]).toBeCloseTo(ring[16][1], 9);
  });
  it("destPoint moves east by ~1 degree at equator for 111 km", () => {
    const [lon, lat] = destPoint(0, 0, 90, 111.2);
    expect(lon).toBeCloseTo(1, 1);
    expect(Math.abs(lat)).toBeLessThan(0.01);
  });
  it("parseFootprint accepts object or JSON string", () => {
    const fp = {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    };
    expect(parseFootprint({ footprint: fp })).toEqual(fp);
    expect(parseFootprint({ footprint: JSON.stringify(fp) })).toEqual(fp);
    expect(parseFootprint({ footprint: "{bad" })).toBeNull();
  });
});
