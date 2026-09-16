import { expect, test } from "playwright/test";

const EXTERNAL = /arcgisonline|opentopomap|openmaptiles|elevation-tiles|unpkg|googleapis|gstatic/;

test("390px: no horizontal overflow, bottom tabs switch drawers, popup visible", async ({
  page,
}) => {
  await page.route(EXTERNAL, (route) => route.abort());
  await page.goto("/?fixtures=test");
  await expect(page.locator("#st-total")).not.toHaveText("—", { timeout: 15000 });
  // 用户视角：不能横向滚动（body overflow hidden），且顶栏/面板都在视口内
  const scroll = await page.evaluate(() => {
    window.scrollTo(80, 0);
    const vw = document.documentElement.clientWidth;
    const inside = [".chrome-top", ".shell.right", "#mobileTabs"].every((sel) => {
      const el = document.querySelector(sel);
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return r.left >= -1 && r.right <= vw + 1;
    });
    return { x: window.scrollX, inside };
  });
  expect(scroll.x).toBe(0);
  expect(scroll.inside).toBe(true);
  await expect(page.locator("#mobileTabs")).toBeVisible();
  // 默认事件流抽屉
  await expect(page.locator(".shell.right")).toBeVisible();
  await expect(page.locator(".shell.left-top")).toBeHidden();
  await page.click('#mobileTabs button[data-mtab="filter"]');
  await expect(page.locator(".shell.left-top")).toBeVisible();
  await expect(page.locator(".shell.right")).toBeHidden();
  await page.click('#mobileTabs button[data-mtab="feed"]');
  await page.locator("#fbody .item").first().click();
  const popup = page.locator(".maplibregl-popup-content");
  await expect(popup).toBeVisible({ timeout: 10000 });
  const box = await popup.boundingBox();
  const vw = page.viewportSize().width;
  // MapLibre 弹窗尖角可能溢出 数像素；断言仍在屏内可见即可
  expect(box.x).toBeGreaterThanOrEqual(-8);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 8);
});
