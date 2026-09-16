/** 事件同步协议：分页快照、游标推进、删除/关闭、窗口淘汰、对账。 */

export const PAGE_LIMIT = 2000;
export const MAX_PAGES = 50;

export function shouldAdvanceCursor(meta) {
  if (!meta) return false;
  if (meta.truncated) return false;
  if (meta.complete === false) return false;
  return true;
}

export function nextCursorFromMeta(meta) {
  if (!meta || !meta.truncated) return null;
  const c = meta.next_cursor;
  if (c == null || c === "") return null;
  return c;
}

export function watermarkFromMeta(meta) {
  if (!shouldAdvanceCursor(meta)) return null;
  if (meta.page_high_water != null) return Number(meta.page_high_water);
  if (meta.high_water != null) return Number(meta.high_water);
  return null;
}

export function mergeIncremental(store, features) {
  let changed = 0;
  for (const f of features || []) {
    const p = f.properties || {};
    if (p.id == null) continue;
    if (p.status === "deleted") {
      if (store.delete(p.id)) changed++;
      continue;
    }
    store.set(p.id, f);
    changed++;
  }
  return changed;
}

export function replaceSnapshot(store, features) {
  store.clear();
  return mergeIncremental(store, features);
}

export function pruneStoreByWindow(store, hours, nowMs) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return 0;
  const cutoff = nowMs - h * 3600 * 1000;
  let n = 0;
  for (const [id, f] of [...store.entries()]) {
    const status = f?.properties?.status;
    if (status === "deleted") {
      store.delete(id);
      n++;
      continue;
    }
    const t = Date.parse(f?.properties?.occurred_at);
    if (!Number.isFinite(t) || t < cutoff) {
      store.delete(id);
      n++;
    }
  }
  return n;
}

export function inTimeWindow(feature, hours, nowMs) {
  const t = Date.parse(feature?.properties?.occurred_at);
  if (!Number.isFinite(t)) return false;
  return t >= nowMs - Number(hours) * 3600 * 1000;
}

export function applyReconcile(store, payload, hours, nowMs) {
  const ids = new Set((payload?.ids || []).map((x) => Number(x)));
  const missing = [];
  const extra = [];
  for (const id of ids) {
    if (!store.has(id)) missing.push(id);
  }
  for (const [id, f] of store.entries()) {
    if (!ids.has(Number(id))) {
      if (!inTimeWindow(f, hours, nowMs) || f?.properties?.status === "deleted") {
        extra.push(id);
      } else if (!ids.has(Number(id))) {
        extra.push(id);
      }
    }
  }
  for (const id of extra) store.delete(id);
  return { missing, extra, matched: ids.size - missing.length };
}

export function buildEventsQuery({ hours, limit = PAGE_LIMIT, sinceSeq, cursor, full }) {
  const params = new URLSearchParams();
  params.set("hours", String(hours));
  params.set("limit", String(limit));
  params.set("fields", "summary");
  if (!full && sinceSeq != null && sinceSeq !== "") {
    params.set("since_seq", String(sinceSeq));
  }
  if (cursor != null && cursor !== "") params.set("cursor", String(cursor));
  return `/api/events?${params.toString()}`;
}

export function collectPages(fetchPage, { hours, sinceSeq, full, limit = PAGE_LIMIT } = {}) {
  const features = [];
  let cursor = null;
  let lastMeta = null;
  let pages = 0;
  const run = async () => {
    for (;;) {
      pages += 1;
      if (pages > MAX_PAGES) {
        return {
          features,
          meta: { ...lastMeta, truncated: true, complete: false },
          pages,
          aborted: true,
        };
      }
      const url = buildEventsQuery({ hours, limit, sinceSeq, cursor, full });
      const fc = await fetchPage(url);
      lastMeta = fc?.meta || {};
      if (Array.isArray(fc?.features)) features.push(...fc.features);
      const next = nextCursorFromMeta(lastMeta);
      if (!next) {
        return {
          features,
          meta: { ...lastMeta, complete: !lastMeta.truncated },
          pages,
          aborted: false,
        };
      }
      cursor = next;
    }
  };
  return run();
}
