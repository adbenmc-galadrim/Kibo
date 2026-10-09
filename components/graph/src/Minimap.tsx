import { type PointerEvent, useRef } from "react";
import { fr } from "./fr";
import { type GraphLayout, NODE_H, NODE_W } from "./layout";
import type { Point, Size, Viewport } from "./viewport";

const W = 160;
const H = 100;

type Props = { layout: GraphLayout; view: Viewport; box: Size; onJump(center: Point): void };
type Rect = { x: number; y: number; w: number; h: number };

const visibleRect = (view: Viewport, box: Size): Rect => ({
  x: -view.pan.x / view.zoom,
  y: -view.pan.y / view.zoom,
  w: box.width / view.zoom,
  h: box.height / view.zoom,
});

function bounds(layout: GraphLayout, visible: Rect): Rect {
  const x = Math.min(0, visible.x);
  const y = Math.min(0, visible.y);
  const right = Math.max(layout.width, visible.x + visible.w);
  const bottom = Math.max(layout.height, visible.y + visible.h);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

export function Minimap({ layout, view, box, onJump }: Props) {
  const visible = visibleRect(view, box);
  const area = bounds(layout, visible);
  const scale = Math.min(W / area.w, H / area.h);
  const offset = {
    x: (W - area.w * scale) / 2 - area.x * scale,
    y: (H - area.h * scale) / 2 - area.y * scale,
  };
  const dragging = useRef(false);
  const jumpTo = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onJump({
      x: (e.clientX - r.left - offset.x) / scale,
      y: (e.clientY - r.top - offset.y) / scale,
    });
  };
  const stopDragging = () => {
    dragging.current = false;
  };
  const toMap = (r: Rect) => ({
    x: offset.x + r.x * scale,
    y: offset.y + r.y * scale,
    width: r.w * scale,
    height: r.h * scale,
  });
  return (
    <svg
      role="img"
      aria-label={fr.minimap}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="absolute right-3 bottom-12 cursor-pointer select-none overflow-hidden rounded-md border bg-card/90"
      onPointerDown={(e) => {
        e.preventDefault();
        dragging.current = true;
        jumpTo(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) jumpTo(e);
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
    >
      {layout.nodes.map((n) => (
        <rect
          key={n.id}
          {...toMap({ x: n.x, y: n.y, w: NODE_W, h: NODE_H })}
          rx={1}
          className="fill-muted-foreground/60"
        />
      ))}
      <rect {...toMap(visible)} className="fill-none stroke-foreground" strokeWidth={1} />
    </svg>
  );
}
