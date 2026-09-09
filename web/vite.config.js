import { defineConfig } from "vite-plus";

// 前端 Vite 开发服务器：热更新预览
// API / WebSocket / 国界数据代理到 FastAPI 后端 (127.0.0.1:8001)
export default defineConfig({
  // 根路径部署：dist 挂载于后端根路径，与 main.js 内 /data /api /ws 绝对路径一致
  base: "/",
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
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
      },
      "/ws": {
        target: "ws://127.0.0.1:8001",
        ws: true,
        changeOrigin: true,
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
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
