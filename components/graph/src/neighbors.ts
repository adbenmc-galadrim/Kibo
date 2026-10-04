import type { GraphEdge } from "./critical-path";
import { type GraphLayout, NODE_H, NODE_W, type NodePosition } from "./layout";

export type Dir = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
export type Rect = { left: number; top: number; right: number; bottom: number };

const byPosition = (a: NodePosition, b: NodePosition) => a.y - b.y || a.x - b.x;

export function neighborOf(
  layout: GraphLayout,
  edges: readonly GraphEdge[],
  current: string,
  dir: Dir,
): string | null {
  const nodes = new Map(layout.nodes.map((n) => [n.id, n]));
  const here = nodes.get(current);
  if (!here) return null;
  if (dir === "ArrowRight" || dir === "ArrowLeft") {
    const forward = dir === "ArrowRight";
    const next = edges
      .filter((e) => e.type === "blocks" && (forward ? e.from === current : e.to === current))
      .flatMap((e) => nodes.get(forward ? e.to : e.from) ?? [])
      .sort(byPosition);
    return next[0]?.id ?? null;
  }
  const step = dir === "ArrowDown" ? 1 : -1;
  const target = here.order + step;
  return (
    layout.nodes.find((n) => n.layer === here.layer && n.isolated === here.isolated && n.order === target)
      ?.id ?? null
  );
}

export function nodesInRect(layout: GraphLayout, rect: Rect): string[] {
  return layout.nodes
    .filter(
      (n) => n.x < rect.right && n.x + NODE_W > rect.left && n.y < rect.bottom && n.y + NODE_H > rect.top,
    )
    .sort(byPosition)
    .map((n) => n.id);
}
