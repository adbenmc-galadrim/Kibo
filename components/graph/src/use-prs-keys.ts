import { type KeyboardEvent, useCallback, useMemo } from "react";
import type { PrNode } from "./pr-stacks";
import type { PrsLayout } from "./prs-layout";

type Place = { node: PrNode; parent: PrNode | null; column: number };

function indexOf(layout: PrsLayout): Map<string, Place> {
  const index = new Map<string, Place>();
  const walk = (node: PrNode, parent: PrNode | null, column: number) => {
    index.set(node.id, { node, parent, column });
    for (const child of node.children) walk(child, node, column);
  };
  layout.columns.forEach((c, i) => {
    walk(c.stack.root, null, i);
  });
  return index;
}

function step(layout: PrsLayout, place: Place, key: string): PrNode | null {
  if (key === "ArrowUp") return place.node.children[0] ?? null;
  if (key === "ArrowDown") return place.parent;
  if (key === "ArrowRight") return layout.columns[place.column + 1]?.stack.root ?? null;
  if (key === "ArrowLeft")
    return place.column > 0 ? (layout.columns[place.column - 1]?.stack.root ?? null) : null;
  return null;
}

export function nextPr(layout: PrsLayout, id: string, key: string): string | null {
  const place = indexOf(layout).get(id);
  return place === undefined ? null : (step(layout, place, key)?.id ?? null);
}

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export function usePrsKeys(layout: PrsLayout): (e: KeyboardEvent<HTMLElement>) => void {
  const index = useMemo(() => indexOf(layout), [layout]);
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (!ARROWS.has(e.key) || !(e.target instanceof HTMLElement)) return;
      const place = index.get(e.target.closest("[data-pr-id]")?.getAttribute("data-pr-id") ?? "");
      if (place === undefined) return;
      e.preventDefault();
      const next = step(layout, place, e.key);
      if (next === null) return;
      const buttons = e.currentTarget.querySelectorAll<HTMLElement>("[data-pr-id]");
      Array.from(buttons)
        .find((b) => b.getAttribute("data-pr-id") === next.id)
        ?.focus();
    },
    [index, layout],
  );
}
