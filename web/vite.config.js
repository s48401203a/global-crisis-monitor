import { defineConfig } from "vite-plus";

// 前端 Vite 开发服务器：热更新预览
// API / WebSocket / 国界数据代理到 FastAPI 后端 (127.0.0.1:8001)
export default defineConfig({
  // 根路径部署：dist 挂载于后端根路径，与 main.js 内 /data /api /ws 绝对路径一致
  base: "/",
  staged: {
    "*": "vp check --fix",
  },
  // 数据文件与夹具不参与格式化：GeoJSON/JSON 数据体积大且由脚本生成
  fmt: {
    ignorePatterns: ["public/data/**", "public/test-fixtures.json", "dist/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    // no-undef 设为 error：模块拆分时漏导入会在 vp check 阶段被拦住，而不是运行时 ReferenceError
    rules: { "vite-plus/prefer-vite-plus-imports": "error", "no-undef": "error" },
    env: { browser: true, es2024: true },
    globals: { process: "readonly" },
    // 纯 JS 项目：不做 TS 类型检查（无 tsconfig，typeCheck 只会报噪音）
    options: { typeAware: false, typeCheck: false },
  },
  server: {
    host: "127.0.0.1",
    port: 5180,
    open: true,
    strictPort: true,
    // Cloudflare quick tunnel uses https://*.trycloudflare.com
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        xfwd: true, // 带 X-Forwarded-For：后端据此区分"本机"与"经隧道进来的"
      },
      "/ws": {
        target: "ws://127.0.0.1:8001",
        ws: true,
        changeOrigin: true,
        xfwd: true,
      },
      // 后端 static 也有 /data；开发时优先 Vite public/data（含地名中英对照等）
      "/data": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        bypass(req) {
          // 一律先走本地 public/data；本地没有时再由代理回源 8000
          if (req.url && req.url.startsWith("/data/")) {
            return req.url;
          }
        },
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4180,
    proxy: {
      "/api": "http://127.0.0.1:8001",
      "/ws": { target: "ws://127.0.0.1:8001", ws: true },
    },
  },
  test: {
    include: ["test/unit/**/*.test.js"],
    environment: "node",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
