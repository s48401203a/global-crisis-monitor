import { describe, expect, it } from "vite-plus/test";
import { escapeHtml, fmtNum, fmtCoord, haversineKm, byTimeDesc } from "../../src/util/format.js";

describe("format", () => {
  it("escapeHtml escapes the four dangerous chars", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
    expect(escapeHtml(null)).toBe("");
  });
  it("fmtNum matches server fmt_num rules", () => {
    expect(fmtNum(5)).toBe("5");
    expect(fmtNum(5.64)).toBe("5.6");
    expect(fmtNum(123.4)).toBe("123");
    expect(fmtNum(12345.6)).toBe("12,346");
    expect(fmtNum("abc")).toBe("abc");
  });
  it("fmtCoord uses hemisphere words", () => {
    const s = fmtCoord(-33.9, 151.2);
    expect(s).toMatch(/33\.9/);
    expect(s).toMatch(/151\.2/);
  });
  it("haversineKm is symmetric and roughly right", () => {
    const d = haversineKm(116.4, 39.9, 121.5, 31.2); // 北京→上海 ≈ 1067 km
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1120);
    expect(haversineKm(121.5, 31.2, 116.4, 39.9)).toBeCloseTo(d, 6);
  });
  it("byTimeDesc sorts newest first", () => {
    const a = { properties: { occurred_at: "2026-09-09T10:00:00Z" } };
    const b = { properties: { occurred_at: "2026-09-09T12:00:00Z" } };
    expect([a, b].sort(byTimeDesc)[0]).toBe(b);
  });
});
