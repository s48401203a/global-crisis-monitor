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
  // 只用本页最后一条已读 change_seq。全局 high_water 含未读/未提交可见序号，不能当水位。
  if (meta.page_high_water == null || meta.page_high_water === "") return null;
  const n = Number(meta.page_high_water);
  return Number.isFinite(n) ? n : null;
}

export function cursorAfterReconcile(prevSeq, { failed } = {}) {
  void failed;
  // 对账不得把 storeSeq 推到 high_water：序列分配早于提交，且窗口外事件也会抬高全局最大值。
  return prevSeq;
}

export function seqOf(feature) {
  const n = Number(feature?.properties?.change_seq);
  return Number.isFinite(n) ? n : 0;
}

export function mergeIncremental(store, features) {
  let changed = 0;
  for (const f of features || []) {
    const p = f.properties || {};
    if (p.id == null) continue;
    if (p.status === "deleted") {
      if (store.delete(p.id) || store.delete(Number(p.id))) changed++;
      continue;
    }
    const cur = store.get(p.id) || store.get(Number(p.id));
    if (cur && seqOf(f) < seqOf(cur)) continue;
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

function storeGet(store, id) {
  if (store.has(id)) return store.get(id);
  if (store.has(Number(id))) return store.get(Number(id));
  return undefined;
}

export function normalizeReconcileVersions(payload) {
  if (Array.isArray(payload?.versions) && payload.versions.length) {
    return payload.versions
      .map((v) => ({
        id: Number(v.id),
        change_seq: Number(v.change_seq) || 0,
        status: v.status || "active",
      }))
      .filter((v) => Number.isFinite(v.id));
  }
  const closed = new Set((payload?.closed_ids || []).map((x) => Number(x)));
  return (payload?.ids || [])
    .map((id) => ({
      id: Number(id),
      change_seq: 0,
      status: closed.has(Number(id)) ? "closed" : "active",
    }))
    .filter((v) => Number.isFinite(v.id));
}

export function applyReconcile(store, payload, hours, nowMs) {
  void hours;
  void nowMs;
  const versions = normalizeReconcileVersions(payload);
  const byId = new Map(versions.map((v) => [v.id, v]));
  const missing = [];
  const stale = [];
  const extra = [];
  for (const v of versions) {
    const f = storeGet(store, v.id);
    if (!f) {
      missing.push(v.id);
      continue;
    }
    const localSeq = seqOf(f);
    const localStatus = f.properties?.status || "active";
    const seqBehind = v.change_seq > 0 && localSeq < v.change_seq;
    const statusBehind = v.status && v.status !== localStatus;
    if (seqBehind || statusBehind) stale.push(v.id);
  }
  for (const id of store.keys()) {
    if (!byId.has(Number(id))) extra.push(id);
  }
  for (const id of extra) store.delete(id);
  const refetch = [...new Set([...missing, ...stale])];
  return {
    missing,
    stale,
    extra,
    refetch,
    matched: versions.length - missing.length,
  };
}

export function buildEventsQuery({ hours, limit = PAGE_LIMIT, sinceSeq, cursor, full, ids } = {}) {
  const params = new URLSearchParams();
  params.set("hours", String(hours ?? 24));
  params.set("limit", String(limit));
  params.set("fields", "summary");
  if (ids && ids.length) {
    params.set("ids", ids.join(","));
    return `/api/events?${params.toString()}`;
  }
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
