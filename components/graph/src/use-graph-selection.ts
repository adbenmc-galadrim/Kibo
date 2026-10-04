import type { Selection } from "@kibo/schema";
import { useSelection } from "@kibo/sdk";
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
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

const MAX_SELECTED = 200;

const sameIds = (a: Selection | null, b: Selection | null) => {
  const left = a?.ids ?? [];
  const right = new Set(b?.ids ?? []);
  return left.length === right.size && left.every((id) => right.has(id));
};

const singleOf = (s: Selection | null) => (s?.ids.length === 1 ? (s.ids[0] ?? null) : null);

const ticketSelection = (ids: readonly string[]): Selection | null =>
  ids.length === 0 ? null : { kind: "ticket", ids: ids.slice(0, MAX_SELECTED) };

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
  const [selection, setSelection] = useSelection();
  const known = useRef<Selection | null>(selection);
  const [focused, setFocused] = useState<string | null>(() => singleOf(selection));
  const [box, setBox] = useState<SelectionBox | null>(null);
  const boxRef = useRef<SelectionBox | null>(null);
  const selected = useMemo<ReadonlySet<string>>(() => new Set(selection?.ids ?? []), [selection]);

  useEffect(() => {
    if (sameIds(selection, known.current)) return;
    known.current = selection;
    setFocused(singleOf(selection));
  }, [selection]);

  const emit = (next: Selection | null, anchor: string | null) => {
    setFocused(anchor);
    if (sameIds(next, known.current)) return;
    known.current = next;
    setSelection(next);
  };
  const select = (id: string) => emit(ticketSelection([id]), id);
  const clear = () => emit(null, null);
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
        emit(ticketSelection(nodesInRect(layout, toScene(boxRect(current), view))), null);
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
