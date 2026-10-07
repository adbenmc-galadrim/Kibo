export type UpdateInfo = {
  version: string;
  currentVersion: string;
  notes: string | null;
  publishedAt: string | null;
};

export type UpdateStep = "check" | "backup" | "install";

export type UpdateStatus =
  | { phase: "idle" }
  | { phase: "checking"; update: UpdateInfo | null }
  | { phase: "current"; checkedAt: number }
  | { phase: "available"; update: UpdateInfo }
  | { phase: "backingUp"; update: UpdateInfo }
  | { phase: "downloading"; update: UpdateInfo; received: number; total: number | null }
  | { phase: "installing"; update: UpdateInfo }
  | { phase: "error"; step: UpdateStep; detail: string; update: UpdateInfo | null };

export type UpdateEvent =
  | { type: "check" }
  | { type: "found"; update: UpdateInfo }
  | { type: "none"; at: number }
  | { type: "checkFailed"; detail: string }
  | { type: "install" }
  | { type: "backedUp" }
  | { type: "backupFailed"; detail: string }
  | { type: "started"; total: number | null }
  | { type: "progress"; chunk: number }
  | { type: "downloaded" }
  | { type: "installFailed"; detail: string };

export const IDLE: UpdateStatus = { phase: "idle" };

const BUSY: readonly UpdateStatus["phase"][] = ["checking", "backingUp", "downloading", "installing"];

function knownUpdate(state: UpdateStatus): UpdateInfo | null {
  return "update" in state ? state.update : null;
}

export function reduceUpdate(state: UpdateStatus, event: UpdateEvent): UpdateStatus {
  switch (event.type) {
    case "check":
      return BUSY.includes(state.phase) ? state : { phase: "checking", update: knownUpdate(state) };
    case "found":
      return { phase: "available", update: event.update };
    case "none":
      return { phase: "current", checkedAt: event.at };
    case "checkFailed":
      return { phase: "error", step: "check", detail: event.detail, update: knownUpdate(state) };
    case "install": {
      const update = knownUpdate(state);
      if (!update || BUSY.includes(state.phase)) return state;
      return { phase: "backingUp", update };
    }
    case "backedUp":
      return state.phase === "backingUp"
        ? { phase: "downloading", update: state.update, received: 0, total: null }
        : state;
    case "backupFailed":
      return { phase: "error", step: "backup", detail: event.detail, update: knownUpdate(state) };
    case "started":
      return state.phase === "downloading" ? { ...state, total: event.total } : state;
    case "progress":
      return state.phase === "downloading" ? { ...state, received: state.received + event.chunk } : state;
    case "downloaded":
      return state.phase === "downloading" ? { phase: "installing", update: state.update } : state;
    case "installFailed":
      return { phase: "error", step: "install", detail: event.detail, update: knownUpdate(state) };
  }
}

export function downloadPercent(state: UpdateStatus): number | null {
  if (state.phase !== "downloading" || state.total === null || state.total <= 0) return null;
  return Math.min(100, Math.round((state.received / state.total) * 100));
}

export type UpdateFailure = "check" | "noRelease" | "invalid" | "backup" | "install" | "appImageOnly";

const APPIMAGE_ONLY = /appimage|unsupported linux package/i;
const NO_RELEASE = /could not fetch a valid release json/i;
const BAD_SIGNATURE = /signature|minisign|public key|base64|invalid symbol|invalid (byte|length|padding)/i;
const BAD_MANIFEST =
  /missing field|expected value|invalid type|unknown variant|`platforms` object|at line \d+ column \d+/i;

export function classifyUpdateFailure(step: UpdateStep, detail: string): UpdateFailure {
  if (step === "backup") return step;
  if (BAD_SIGNATURE.test(detail)) return "invalid";
  if (step === "check") {
    if (NO_RELEASE.test(detail)) return "noRelease";
    return BAD_MANIFEST.test(detail) ? "invalid" : "check";
  }
  return APPIMAGE_ONLY.test(detail) ? "appImageOnly" : "install";
}
