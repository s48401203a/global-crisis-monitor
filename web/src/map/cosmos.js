/** 地球仪星空背景：银河带 + 闪烁星点（screen 合成），平面图不显示。 */
import { prefersReducedMotion } from "../util/timing.js";

let cosmosOn = false;

let cosmosRaf = 0;

let cosmosStars = [];

let cosmosStatic = null;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setCosmosVisible(on) {
  cosmosOn = !!on;
  const stage = document.getElementById("map-stage");
  if (stage) stage.classList.toggle("is-cosmos", cosmosOn);
  if (cosmosOn) {
    initCosmos();
    if (!cosmosRaf) cosmosTick();
  }
}

function initCosmos() {
  const canvas = document.getElementById("map-cosmos");
  if (!canvas) return;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    bakeCosmos();
  };
  if (canvas.dataset.bound !== "1") {
    canvas.dataset.bound = "1";
    window.addEventListener("resize", resize);
  }
  resize();
}

function bakeCosmos() {
  const canvas = document.getElementById("map-cosmos");
  if (!canvas || canvas.width < 2) return;
  const w = canvas.width;
  const h = canvas.height;
  const rnd = mulberry32(20260814);
  cosmosStatic = document.createElement("canvas");
  cosmosStatic.width = w;
  cosmosStatic.height = h;
  const ctx = cosmosStatic.getContext("2d");

  const sky = ctx.createRadialGradient(w * 0.5, h * 0.48, h * 0.08, w * 0.5, h * 0.5, h * 0.85);
  sky.addColorStop(0, "rgba(18, 28, 58, 0.35)");
  sky.addColorStop(0.45, "rgba(10, 14, 36, 0.55)");
  sky.addColorStop(1, "rgba(4, 6, 18, 0.2)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w * 0.5, h * 0.52);
  ctx.rotate(-0.42);
  const band = ctx.createLinearGradient(0, -h * 0.22, 0, h * 0.22);
  band.addColorStop(0, "rgba(40, 50, 80, 0)");
  band.addColorStop(0.35, "rgba(150, 168, 210, 0.07)");
  band.addColorStop(0.5, "rgba(210, 196, 168, 0.13)");
  band.addColorStop(0.62, "rgba(120, 140, 190, 0.08)");
  band.addColorStop(1, "rgba(40, 50, 80, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(-w, -h * 0.28, w * 2, h * 0.56);
  for (let i = 0; i < 90; i++) {
    const x = (rnd() - 0.5) * w * 1.6;
    const y = (rnd() - 0.5) * h * 0.18;
    const r = (20 + rnd() * 90) * (w / 1400);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rnd() > 0.45;
    g.addColorStop(0, warm ? "rgba(220, 200, 160, 0.09)" : "rgba(140, 170, 230, 0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  cosmosStars = [];
  const n = Math.round((w * h) / 1800);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const dx = (x / w - 0.5) * Math.cos(-0.42) + (y / h - 0.52) * Math.sin(-0.42);
    const onBand = Math.abs(dx) < 0.12;
    if (onBand && rnd() > 0.35) {
      /* denser along milky way */
    } else if (rnd() > 0.72) {
      continue;
    }
    const roll = rnd();
    const bright = roll > 0.97 ? 0.95 : roll > 0.88 ? 0.7 : 0.28 + rnd() * 0.35;
    const hue = rnd();
    const color = hue < 0.12 ? [180, 210, 255] : hue > 0.88 ? [255, 214, 170] : [230, 236, 255];
    const star = {
      x,
      y,
      r: bright > 0.85 ? 1.6 + rnd() * 1.2 : 0.5 + rnd() * 0.9,
      a: bright,
      tw: rnd() * Math.PI * 2,
      color,
      twinkle: rnd() > 0.62,
    };
    cosmosStars.push(star);
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${bright * 0.85})`;
    ctx.beginPath();
    ctx.arc(x, y, star.r, 0, Math.PI * 2);
    ctx.fill();
    if (bright > 0.86) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, star.r * 6);
      glow.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},0.35)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, star.r * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function cosmosTick() {
  cosmosRaf = 0;
  const canvas = document.getElementById("map-cosmos");
  if (!canvas || !cosmosOn || !cosmosStatic) {
    if (cosmosOn) cosmosRaf = requestAnimationFrame(cosmosTick);
    return;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(cosmosStatic, 0, 0);
  if (!prefersReducedMotion()) {
    const t = performance.now() / 900;
    for (const s of cosmosStars) {
      if (!s.twinkle) continue;
      const a = s.a * (0.55 + 0.45 * Math.sin(t + s.tw));
      ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  cosmosRaf = requestAnimationFrame(cosmosTick);
}

export { initCosmos, setCosmosVisible };
