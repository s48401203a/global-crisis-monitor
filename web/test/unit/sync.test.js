import { describe, expect, it } from "vite-plus/test";
import {
  applyReconcile,
  buildEventsQuery,
  cursorAfterReconcile,
  mergeIncremental,
  nextCursorFromMeta,
  pruneStoreByWindow,
  replaceSnapshot,
  shouldAdvanceCursor,
  watermarkFromMeta,
} from "../../src/api/sync.js";

function feat(id, extra = {}) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: { id, occurred_at: extra.occurred_at || new Date().toISOString(), ...extra },
  };
}

describe("sync protocol", () => {
  it("does not advance cursor when truncated", () => {
    expect(shouldAdvanceCursor({ truncated: true, next_cursor: 9 })).toBe(false);
    expect(watermarkFromMeta({ truncated: true, page_high_water: 9 })).toBeNull();
  });

  it("advances only when the page is complete", () => {
    expect(shouldAdvanceCursor({ truncated: false, complete: true, page_high_water: 42 })).toBe(
      true,
    );
    expect(watermarkFromMeta({ truncated: false, complete: true, page_high_water: 42 })).toBe(42);
  });

  it("returns next_cursor only while truncated", () => {
    expect(nextCursorFromMeta({ truncated: true, next_cursor: 7 })).toBe(7);
    expect(nextCursorFromMeta({ truncated: false, next_cursor: 7 })).toBeNull();
  });

  it("mergeIncremental deletes, upserts, and is idempotent", () => {
    const store = new Map();
    mergeIncremental(store, [feat(1), feat(2, { status: "active" })]);
    mergeIncremental(store, [feat(1, { status: "revised" }), feat(2, { status: "deleted" })]);
    mergeIncremental(store, [feat(1, { status: "revised" })]);
    expect(store.has(1)).toBe(true);
    expect(store.has(2)).toBe(false);
    expect(store.get(1).properties.status).toBe("revised");
  });

  it("prunes events that slide out of the time window", () => {
    const store = new Map();
    const now = Date.parse("2026-09-16T12:00:00Z");
    store.set(1, feat(1, { occurred_at: "2026-09-16T11:00:00Z" }));
    store.set(2, feat(2, { occurred_at: "2026-09-14T11:00:00Z" }));
    const n = pruneStoreByWindow(store, 24, now);
    expect(n).toBe(1);
    expect([...store.keys()]).toEqual([1]);
  });

  it("reconcile drops extras and reports missing ids", () => {
    const store = new Map();
    replaceSnapshot(store, [feat(1), feat(2)]);
    const now = Date.now();
    const diff = applyReconcile(store, { ids: [2, 3] }, 24, now);
    expect(diff.missing).toEqual([3]);
    expect(store.has(1)).toBe(false);
    expect(store.has(2)).toBe(true);
  });

  it("same id with newer change_seq is stale content, not already synced", () => {
    const store = new Map();
    store.set(1, feat(1, { change_seq: 10, status: "active", severity: 0.4, lat: 1 }));
    const diff = applyReconcile(
      store,
      {
        versions: [{ id: 1, change_seq: 20, status: "active" }],
        ids: [1],
        high_water: 99,
      },
      24,
      Date.now(),
    );
    expect(diff.missing).toEqual([]);
    expect(diff.stale).toEqual([1]);
    expect(diff.refetch).toEqual([1]);
  });

  it("active becoming closed is a refetch even if the id already exists", () => {
    const store = new Map();
    store.set(1, feat(1, { change_seq: 10, status: "active" }));
    const diff = applyReconcile(
      store,
      {
        versions: [{ id: 1, change_seq: 11, status: "closed" }],
        ids: [1],
        closed_ids: [1],
        high_water: 11,
      },
      24,
      Date.now(),
    );
    expect(diff.missing).toEqual([]);
    expect(diff.refetch).toContain(1);
    expect(store.has(1)).toBe(true);
  });

  it("deleted extra is dropped from the store", () => {
    const store = new Map();
    store.set(1, feat(1, { change_seq: 3, status: "active" }));
    store.set(2, feat(2, { change_seq: 4, status: "active" }));
    applyReconcile(
      store,
      { versions: [{ id: 2, change_seq: 4, status: "active" }], ids: [2] },
      24,
      Date.now(),
    );
    expect(store.has(1)).toBe(false);
    expect(store.has(2)).toBe(true);
  });

  it("late lower-seq update still refetches when local version is behind", () => {
    const store = new Map();
    store.set(1, feat(1, { change_seq: 5, status: "active", severity: 0.3 }));
    const diff = applyReconcile(
      store,
      {
        versions: [{ id: 1, change_seq: 8, status: "active" }],
        ids: [1],
        high_water: 100,
      },
      24,
      Date.now(),
    );
    expect(diff.refetch).toEqual([1]);
  });

  it("does not treat global high_water as a safe incremental watermark", () => {
    expect(watermarkFromMeta({ truncated: false, complete: true, high_water: 900 })).toBeNull();
  });

  it("failed refetch must not advance the cursor", () => {
    expect(
      cursorAfterReconcile(40, { refetch: [1], applied: false, failed: true, highWater: 900 }),
    ).toBe(40);
    expect(
      cursorAfterReconcile(40, { refetch: [], applied: true, failed: false, highWater: 900 }),
    ).toBe(40);
  });

  it("out-of-order older change_seq does not clobber newer local feature", () => {
    const store = new Map();
    store.set(1, feat(1, { change_seq: 20, severity: 0.9, status: "active" }));
    mergeIncremental(store, [feat(1, { change_seq: 15, severity: 0.2, status: "active" })]);
    expect(store.get(1).properties.severity).toBe(0.9);
    expect(store.get(1).properties.change_seq).toBe(20);
  });

  it("interleaved older snapshot merge does not overwrite a newer incremental", () => {
    const store = new Map();
    mergeIncremental(store, [feat(1, { change_seq: 30, severity: 0.7, status: "revised" })]);
    mergeIncremental(store, [feat(1, { change_seq: 12, severity: 0.1, status: "active" })]);
    expect(store.get(1).properties.severity).toBe(0.7);
  });

  it("builds snapshot vs incremental query strings", () => {
    const snap = buildEventsQuery({ hours: 24, full: true, cursor: 10 });
    expect(snap).toContain("hours=24");
    expect(snap).toContain("cursor=10");
    expect(snap).not.toContain("since_seq");
    const inc = buildEventsQuery({ hours: 24, sinceSeq: 8, full: false });
    expect(inc).toContain("since_seq=8");
  });
});
