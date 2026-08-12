import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto("http://127.0.0.1:5174/?fixtures=test", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
const state = await page.evaluate(() => ({
  hasMap: !!window.__crisisMap,
  mapReady: typeof window.__crisisMap?.isStyleLoaded === "function",
  styleLoaded: window.__crisisMap?.isStyleLoaded?.() ?? null,
  zoom: window.__crisisMap?.getZoom?.() ?? null,
  hasMaplibre: !!window.maplibregl,
}));
console.log("LOGS:\n" + logs.join("\n"));
console.log("STATE:", JSON.stringify(state));
await browser.close();
