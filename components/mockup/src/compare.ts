import type { DesignFrame } from "@kibo/schema";

export type CompareMode = "side" | "overlay";
export type CompareState = {
  on: boolean;
  mode: CompareMode;
  reference: number | null;
  opacity: number;
  wipe: number;
  swapped: boolean;
};
export type CompareAction =
  | { kind: "toggle" }
  | { kind: "mode"; mode: CompareMode }
  | { kind: "reference"; index: number }
  | { kind: "opacity"; value: number }
  | { kind: "wipe"; value: number }
  | { kind: "swap" }
  | { kind: "reset" };
export type CompareContext = { imageIndexes: readonly number[]; current: number };

export const COMPARE_OFF: CompareState = {
  on: false,
  mode: "side",
  reference: null,
  opacity: 50,
  wipe: 100,
  swapped: false,
};

export function defaultReference(imageIndexes: readonly number[], current: number): number | null {
  return imageIndexes.find((i) => i > current) ?? imageIndexes[0] ?? null;
}

const bounded = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;

function opened(ctx: CompareContext): CompareState {
  const reference = defaultReference(ctx.imageIndexes, ctx.current);
  return reference === null ? COMPARE_OFF : { ...COMPARE_OFF, on: true, reference };
}

export function compareReducer(
  state: CompareState,
  action: CompareAction,
  ctx: CompareContext,
): CompareState {
  if (action.kind === "reset") return COMPARE_OFF;
  if (action.kind === "toggle") return state.on ? COMPARE_OFF : opened(ctx);
  if (!state.on) return state;
  switch (action.kind) {
    case "mode":
      return { ...state, mode: action.mode };
    case "reference":
      return ctx.imageIndexes.includes(action.index) ? { ...state, reference: action.index } : state;
    case "opacity":
      return { ...state, opacity: bounded(action.value, state.opacity) };
    case "wipe":
      return { ...state, wipe: bounded(action.value, state.wipe) };
    case "swap":
      return { ...state, swapped: !state.swapped };
  }
}

export function normalizeCompare(state: CompareState, ctx: CompareContext): CompareState {
  if (!state.on || (state.reference !== null && ctx.imageIndexes.includes(state.reference))) return state;
  const reference = defaultReference(ctx.imageIndexes, ctx.current);
  return reference === null ? COMPARE_OFF : { ...state, reference };
}

export const clipFor = (wipe: number): string => `inset(0 ${100 - wipe}% 0 0)`;

export const isImageFrame = (f: Pick<DesignFrame, "mime">): boolean => f.mime !== "text/html";
