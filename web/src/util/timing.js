/** 动效/时序小工具。 */

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) {
    return false;
  }
}

function waitMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { prefersReducedMotion, waitMs };
