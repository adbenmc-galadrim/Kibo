import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import type { GraphEdge } from "./critical-path";
import type { GraphLayout } from "./layout";
import { type Dir, neighborOf, nodesInRect, type Rect } from "./neighbors";
import type { Point, Viewport } from "./viewport";

const ARROWS: Record<Dir, true> = { ArrowLeft: true, ArrowRight: true, ArrowUp: true, ArrowDown: true };
const isArrow = (key: string): key is Dir => key in ARROWS;

export type SelectionBox = { start: Point; end: Point };

export const boxRect = ({ start, end }: SelectionBox): Rect => ({
  left: Math.min(start.x, end.x),
  top: Math.min(start.y, end.y),
  right: Math.max(start.x, end.x),
  bottom: Math.max(start.y, end.y),
});

const toScene = (r: Rect, v: Viewport): Rect => ({
  left: (r.left - v.pan.x) / v.zoom,
  top: (r.top - v.pan.y) / v.zoom,
  right: (r.right - v.pan.x) / v.zoom,
  bottom: (r.bottom - v.pan.y) / v.zoom,
});

const onBackground = (e: PointerEvent<HTMLElement>) =>
  !(e.target instanceof Element && e.target.closest("button, svg[role='img']"));

const handlesKeys = (e: KeyboardEvent<HTMLElement>) =>
  e.target === e.currentTarget || (e.target instanceof Element && e.target.closest("[data-node]") !== null);

const localPoint = (e: PointerEvent<HTMLElement>): Point => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

function relatedTo(edges: readonly GraphEdge[], id: string | null): ReadonlySet<string> {
  if (id === null) return new Set();
  return new Set(edges.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : [])));
}

type Input = {
  layout: GraphLayout;
  edges: readonly GraphEdge[];
  view: Viewport;
  onOpen(id: string): void;
};

export function useGraphSelection({ layout, edges, view, onOpen }: Input) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);
  const [box, setBox] = useState<SelectionBox | null>(null);
  const boxRef = useRef<SelectionBox | null>(null);

  const select = (id: string) => {
    setSelected(new Set([id]));
    setFocused(id);
  };
  const clear = () => {
    setSelected(new Set());
    setFocused(null);
  };
  const updateBox = (next: SelectionBox | null) => {
    boxRef.current = next;
    setBox(next);
  };

  return {
    selected,
    focused,
    box,
    related: relatedTo(edges, focused),
    select,
    pointer: {
      onPointerDown: (e: PointerEvent<HTMLElement>): boolean => {
        if (!onBackground(e)) return false;
        if (!e.shiftKey) {
          clear();
          return false;
        }
        const at = localPoint(e);
        updateBox({ start: at, end: at });
        e.currentTarget.setPointerCapture(e.pointerId);
        return true;
      },
      onPointerMove: (e: PointerEvent<HTMLElement>): boolean => {
        const current = boxRef.current;
        if (!current) return false;
        updateBox({ start: current.start, end: localPoint(e) });
        return true;
      },
      onPointerUp: (): boolean => {
        const current = boxRef.current;
        if (!current) return false;
        updateBox(null);
        setFocused(null);
        setSelected(new Set(nodesInRect(layout, toScene(boxRect(current), view))));
        return true;
      },
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (!handlesKeys(e)) return;
      if (e.key === "Escape") {
        clear();
        return;
      }
      if (e.key === "Enter" && focused) {
        e.preventDefault();
        onOpen(focused);
        return;
      }
      if (isArrow(e.key) && focused) {
        const next = neighborOf(layout, edges, focused, e.key);
        e.preventDefault();
        if (!next) return;
        select(next);
        e.currentTarget.querySelector<HTMLElement>(`[data-node="${CSS.escape(next)}"]`)?.focus();
      }
    },
  };
}
