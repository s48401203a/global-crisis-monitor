// Playwright 端到端：默认 fixtures 模式（?fixtures=test），不依赖后端与外网瓦片
// 运行：npx playwright test        （需 dev 服务器 5180 已启动，或由 webServer 自动拉起）
import { defineConfig, devices } from "playwright/test";

const PORT = process.env.VITE_PORT || 5180;

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    viewport: { width: 1600, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `./node_modules/.bin/vp dev --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } },
      testIgnore: /mobile\.spec\.js/,
    },
    {
      // 只装了 chromium：用 iPhone 13 的视口/触屏/UA，但引擎用 chromium
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium", defaultBrowserType: "chromium" },
      testMatch: /mobile\.spec\.js/,
    },
  ],
});
