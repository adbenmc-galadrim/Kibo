import { type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  clampZoom,
  fitAll,
  fitNode,
  type Point,
  panBy,
  type Size,
  type Viewport,
  wheelAction,
  zoomAt,
} from "./viewport";

const INITIAL: Viewport = { zoom: 1, pan: { x: 24, y: 24 } };
const EMPTY: Size = { width: 0, height: 0 };

function useBoxSize(ref: RefObject<HTMLElement | null>): Size {
  const [box, setBox] = useState<Size>(EMPTY);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return box;
}

function useWheel(ref: RefObject<HTMLElement | null>, apply: (f: (v: Viewport) => Viewport) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const action = wheelAction(e);
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const focus = { x: e.clientX - r.left, y: e.clientY - r.top };
      apply((v) =>
        action.kind === "zoom" ? zoomAt(v, action.factor, focus) : panBy(v, action.dx, action.dy),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, apply]);
}

export type GraphViewport = {
  view: Viewport;
  box: Size;
  zoomTo(zoom: number): void;
  fit(): void;
  frame(node: Point, size: Size): void;
  centerOn(point: Point): void;
  pointer: {
    onPointerDown(e: PointerEvent<HTMLElement>): void;
    onPointerMove(e: PointerEvent<HTMLElement>): void;
    onPointerUp(): void;
  };
};

export function useGraphViewport(ref: RefObject<HTMLElement | null>, content: Size): GraphViewport {
  const [view, setView] = useState<Viewport>(INITIAL);
  const box = useBoxSize(ref);
  const touched = useRef(false);
  const drag = useRef<{ start: Point; from: Point } | null>(null);

  const apply = useCallback((f: (v: Viewport) => Viewport) => {
    touched.current = true;
    setView(f);
  }, []);
  useWheel(ref, apply);

  const { width, height } = content;
  useEffect(() => {
    if (touched.current || box.width <= 0 || box.height <= 0) return;
    setView(fitAll({ width, height }, box));
  }, [width, height, box]);

  const center = { x: box.width / 2, y: box.height / 2 };
  return {
    view,
    box,
    zoomTo: (zoom) => apply((v) => zoomAt(v, clampZoom(zoom) / v.zoom, center)),
    fit: () => {
      touched.current = false;
      setView(fitAll(content, box));
    },
    frame: (node, size) => apply(() => fitNode(node, size, box)),
    centerOn: (p) =>
      apply((v) => ({ ...v, pan: { x: center.x - p.x * v.zoom, y: center.y - p.y * v.zoom } })),
    pointer: {
      onPointerDown: (e) => {
        if (e.target instanceof Element && e.target.closest("button, svg[role='img']")) return;
        drag.current = { start: { x: e.clientX, y: e.clientY }, from: view.pan };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e) => {
        const d = drag.current;
        if (!d) return;
        const pan = { x: d.from.x + e.clientX - d.start.x, y: d.from.y + e.clientY - d.start.y };
        apply((v) => ({ ...v, pan }));
      },
      onPointerUp: () => {
        drag.current = null;
      },
    },
  };
}
