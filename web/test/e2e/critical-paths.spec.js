import { expect, test } from "playwright/test";

// 拦截外部瓦片/字形域名：断网也能跑；同时断言页面本身没有 CDN 依赖
const EXTERNAL = /arcgisonline|opentopomap|openmaptiles|elevation-tiles|unpkg|googleapis|gstatic/;

test.beforeEach(async ({ page }) => {
  await page.route(EXTERNAL, (route) => route.abort());
});

test("loads in fixtures mode without any CDN script/style", async ({ page }) => {
  const blocked = [];
  page.on("request", (r) => {
    if (/unpkg|googleapis|gstatic/.test(r.url())) blocked.push(r.url());
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?fixtures=test");
  await expect(page.locator("#st-total")).not.toHaveText("—", { timeout: 15000 });
  expect(blocked).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.locator("#fbody .item").first()).toBeVisible();
});

test("time window, search, popup, globe, language", async ({ page }) => {
  await page.goto("/?fixtures=test");
  await expect(page.locator("#st-total")).not.toHaveText("—", { timeout: 15000 });
  const before = await page.locator("#st-total").textContent();
  expect(Number(before)).toBeGreaterThan(0);

  await page.fill("#eventSearch", "类型:earthquake");
  await page.press("#eventSearch", "Enter");
  await expect(page.locator("#searchMeta")).toContainText("/");
  await page.fill("#eventSearch", "");
  await page.press("#eventSearch", "Escape");

  await page.locator("#fbody .item").first().click();
  await expect(page.locator(".maplibregl-popup h4")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".maplibregl-popup .grade-badge")).toBeVisible();

  await page.click("#btnGlobe");
  await expect(page.locator("#btnGlobe")).toHaveClass(/active/);
  await expect(page.locator("#btnGlobe")).toHaveAttribute("aria-selected", "true");

  await page.click("#btnLangEn");
  await expect(page.locator("h1")).toHaveText("Global Crisis Monitor");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.click("#btnLangZh");
});

test("type layer toggles and theater layer are keyboard reachable", async ({ page }) => {
  await page.goto("/?fixtures=test");
  await expect(page.locator("#st-total")).not.toHaveText("—", { timeout: 15000 });
  const eq = page.locator('#typeLegend label[data-type="earthquake"]');
  await eq.click();
  await expect(eq).toHaveClass(/is-off/);
  await eq.click();
  await expect(eq).not.toHaveClass(/is-off/);
  // 事件流条目可聚焦并可用键盘打开
  const first = page.locator("#fbody .item").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".maplibregl-popup h4")).toBeVisible({ timeout: 10000 });
});
