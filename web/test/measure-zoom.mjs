// B2 实测：z4 -> z12 的耗时与 tile 请求数（基线/改后对比）
// 用法：vp dev 后台运行后，在 web/ 下 `vp node test/measure-zoom.mjs <tag>`
import { chromium } from "playwright";

const PAGE_URL = "http://127.0.0.1:5174/?fixtures=test";
const TILE_HOSTS = ["server.arcgisonline.com", "tile.opentopomap.org"];
const CENTER = [139.69, 35.69]; // 东京（有 fx-cyc-1 测试数据）
const Z_START = 4;
const Z_END = 12;
const ROUNDS = 3;

function isTile(url) {
  return TILE_HOSTS.some((h) => url.includes(h));
}

async function waitIdle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const m = window.__crisisMap;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          m.off("idle", finish);
          resolve();
        };
        m.on("idle", finish);
        setTimeout(finish, 12000); // 12s 兜底：tile 持续加载不触发 idle 时也要继续
      })
  );
}

async function measure(browser) {
  const page = await browser.newPage();
  let tileCount = 0;
  let tileBytes = 0;
  page.on("response", async (resp) => {
    if (isTile(resp.url())) {
      tileCount++;
      try {
        tileBytes += (await resp.body()).length;
      } catch (_) {}
    }
  });

  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__crisisMap && typeof window.__crisisMap.getZoom === "function",
    null,
    { timeout: 30000 }
  );
  // 等 fixtures refresh 完成
  await page.waitForTimeout(3000);

  const results = [];
  for (let i = 0; i < ROUNDS; i++) {
    // 回到 z4 起点（jumpTo 无动画，瞬间）
    await page.evaluate(([z, c]) => {
      window.__crisisMap.jumpTo({ center: c, zoom: z });
    }, [Z_START, CENTER]);
    await waitIdle(page);
    await page.waitForTimeout(800);

    // 清零
    tileCount = 0;
    tileBytes = 0;

    const t0 = Date.now();
    await page.evaluate(([z, c]) => {
      window.__crisisMap.flyTo({ center: c, zoom: z, duration: 800 });
    }, [Z_END, CENTER]);
    await waitIdle(page);
    const elapsed = Date.now() - t0;

    results.push({ round: i + 1, ms: elapsed, tiles: tileCount, kb: Math.round(tileBytes / 1024) });
  }

  await page.close();
  return results;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const tag = process.argv[2] || "run";
  const results = await measure(browser);
  console.log(`\n=== ${tag} ===`);
  console.log("round | ms | tiles | KB");
  results.forEach((r) => console.log(`${r.round} | ${r.ms} | ${r.tiles} | ${r.kb}`));
  const avg = (k) => Math.round(results.reduce((a, r) => a + r[k], 0) / results.length);
  console.log(`AVG   | ${avg("ms")} | ${avg("tiles")} | ${avg("kb")}`);
} finally {
  await browser.close();
}
