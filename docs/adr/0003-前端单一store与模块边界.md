# ADR-0003 · 前端拆分：单一 state store + 按职责分模块，无 CDN 运行时依赖

- 日期：2026-09-09 · 状态：已采纳（Phase 3）

## 背景
`web/src/main.js` 4834 行、35 个模块级可变状态互相引用；maplibre-gl 与字体走 CDN，与"本地优先"矛盾；无法单测。

## 决定
- 跨模块共享的可变状态全部放 `state.js`（`state.x`），常量放 `constants.js`；模块只导出函数。
- 模块按职责：`api/`（后端交互）、`pipeline.js`（筛选与渲染编排）、`grade/brief/headline`（纯函数）、`panels/ popup/ tour/ breaking`（交互）、`map/*`（地图）、`util/*`。
- `main.js` 只做装配：图层、DOM 事件、语言应用。
- `maplibre-gl` 入 npm 打包，字体用系统栈；lint 开 `no-undef=error`。

## 后果
- 模块间存在函数级循环引用（ESM 函数提升下安全），后续可用事件总线进一步解耦。
- 新增共享状态必须进 `state.js`；禁止 `window.*` 全局与内联 `onclick`。
