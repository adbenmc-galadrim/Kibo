export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Viewport = { zoom: number; pan: Point };

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
const PADDING = 24;

export const clampZoom = (z: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

export function zoomAt(v: Viewport, factor: number, focus: Point): Viewport {
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  return {
    zoom,
    pan: { x: focus.x - (focus.x - v.pan.x) * k, y: focus.y - (focus.y - v.pan.y) * k },
  };
}

export const panBy = (v: Viewport, dx: number, dy: number): Viewport => ({
  ...v,
  pan: { x: v.pan.x + dx, y: v.pan.y + dy },
});

export function fitAll(content: Size, box: Size, padding = PADDING): Viewport {
  const room = { width: box.width - 2 * padding, height: box.height - 2 * padding };
  if (content.width <= 0 || content.height <= 0 || room.width <= 0 || room.height <= 0) {
    return { zoom: 1, pan: { x: padding, y: padding } };
  }
  const zoom = clampZoom(Math.min(room.width / content.width, room.height / content.height, 1));
  return {
    zoom,
    pan: {
      x: (box.width - content.width * zoom) / 2,
      y: (box.height - content.height * zoom) / 2,
    },
  };
}

export function fitNode(node: Point, nodeSize: Size, box: Size, zoom = 1.25): Viewport {
  const center = { x: node.x + nodeSize.width / 2, y: node.y + nodeSize.height / 2 };
  return { zoom, pan: { x: box.width / 2 - center.x * zoom, y: box.height / 2 - center.y * zoom } };
}

export type WheelInput = { deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean };
export type WheelAction = { kind: "zoom"; factor: number } | { kind: "pan"; dx: number; dy: number };

export const wheelAction = (e: WheelInput): WheelAction =>
  e.ctrlKey || e.metaKey
    ? { kind: "zoom", factor: Math.exp(-e.deltaY * 0.01) }
    : { kind: "pan", dx: -e.deltaX, dy: -e.deltaY };
