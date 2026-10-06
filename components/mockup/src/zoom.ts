export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type ZoomState = { scale: number; pan: Point };
export type ZoomAction =
  | { kind: "zoom"; factor: number }
  | { kind: "pan"; dx: number; dy: number }
  | { kind: "fit" }
  | { kind: "none" };

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 8;
export const ZOOM_STEP = 1.25;
export const KEY_PAN = 40;
export const EDGE_MARGIN = 32;
export const FITTED: ZoomState = { scale: 1, pan: { x: 0, y: 0 } };

export const clampScale = (s: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 1000) / 1000));

export function fittedSize(image: Size, box: Size, fit: "contain" | "width"): Size {
  if (image.width <= 0 || image.height <= 0 || box.width <= 0 || box.height <= 0)
    return { width: 0, height: 0 };
  const k =
    fit === "width" ? box.width / image.width : Math.min(box.width / image.width, box.height / image.height);
  return { width: image.width * k, height: image.height * k };
}

export function zoomAt(state: ZoomState, factor: number, focus: Point): ZoomState {
  const scale = clampScale(state.scale * factor);
  const k = scale / state.scale;
  return {
    scale,
    pan: { x: focus.x - (focus.x - state.pan.x) * k, y: focus.y - (focus.y - state.pan.y) * k },
  };
}

export const panBy = (state: ZoomState, dx: number, dy: number): ZoomState => ({
  ...state,
  pan: { x: state.pan.x + dx, y: state.pan.y + dy },
});

const within = (value: number, limit: number): number => Math.min(limit, Math.max(-limit, value));

export function clampPan(state: ZoomState, fitted: Size, box: Size): ZoomState {
  const limit = {
    x: Math.max(0, box.width / 2 + (fitted.width * state.scale) / 2 - EDGE_MARGIN),
    y: Math.max(0, box.height / 2 + (fitted.height * state.scale) / 2 - EDGE_MARGIN),
  };
  return { ...state, pan: { x: within(state.pan.x, limit.x), y: within(state.pan.y, limit.y) } };
}

export const isPannable = (state: ZoomState, fitted: Size, box: Size): boolean =>
  state.scale > 1 || fitted.width > box.width + 1 || fitted.height > box.height + 1;

export function wheelAction(
  e: { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean },
  pannable: boolean,
): ZoomAction {
  if (e.ctrlKey || e.metaKey) return { kind: "zoom", factor: Math.exp(-e.deltaY * 0.01) };
  return pannable ? { kind: "pan", dx: -e.deltaX, dy: -e.deltaY } : { kind: "none" };
}

const KEY_PANS: Record<string, Point> = {
  ArrowLeft: { x: KEY_PAN, y: 0 },
  ArrowRight: { x: -KEY_PAN, y: 0 },
  ArrowUp: { x: 0, y: KEY_PAN },
  ArrowDown: { x: 0, y: -KEY_PAN },
};

export function keyAction(e: {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}): ZoomAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "+" || e.key === "=") return { kind: "zoom", factor: ZOOM_STEP };
  if (e.key === "-") return { kind: "zoom", factor: 1 / ZOOM_STEP };
  if (e.key === "0") return { kind: "fit" };
  const pan = e.shiftKey ? KEY_PANS[e.key] : undefined;
  return pan ? { kind: "pan", dx: pan.x, dy: pan.y } : null;
}

export const doubleClick = (state: ZoomState, focus: Point): ZoomState =>
  state.scale === 1 ? zoomAt(state, 2, focus) : FITTED;

export const percent = (scale: number): string => `${Math.round(scale * 100)} %`;
