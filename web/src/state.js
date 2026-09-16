/** 跨模块共享的可变状态（单一 store）。只放需要跨模块读写的量；模块私有状态留在各自模块。 */
import { FILTERABLE_TYPES } from "./constants.js";
import { getPref } from "./storage.js";

export const state = {
  currentView: "global",
  lastFeatures: [],
  searchRaw: "",
  searchParsed: null,
  mapReady: false,
  panelsCollapsed: getPref("panelsCollapsed", false) === true,
  tourList: [],
  tourIndex: -1,
  tourFlying: false,
  tourPopup: null,
  tourActiveId: null,
  tourMode: false,
  tourScope: "time",
  tourFocus: null,
  lastEnrichedPoints: [],
  mapMode: "flat",
  surfaceMode: "sat",
  typeFilterEnabled: (() => {
    const allOn = {};
    for (const it of FILTERABLE_TYPES) allOn[it.type] = true;
    const saved = getPref("typeFilters");
    if (saved && typeof saved === "object") {
      for (const it of FILTERABLE_TYPES) {
        if (typeof saved[it.type] === "boolean") allOn[it.type] = saved[it.type];
      }
    }
    return allOn;
  })(),
  breakingAlertBusy: false,
  applyingFeatures: false,
  breakingCruisePaused: false,
  breakingDwellCancel: null,
  popupCloseFromCode: false,
  effectsFocusId: null,
  _eqWaveExtras: [],
  _eqWaveTimer: null,
  theaterFeatures: [],
  storeHours: null,
  storeSince: null,
  storeSeq: null,
  incrementalTimer: 0,
  reconcileTimer: 0,
  wsReconnectTimer: 0,
  wsBackoffMs: 1000,
  refreshInFlight: null,
  pipelineState: { status: "ok", bad: 0 },
  lastToastKey: "",
  lastToastAt: 0,
};
