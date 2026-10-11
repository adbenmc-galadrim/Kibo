import { cn } from "@kibo/sdk/lib/utils";
import { useId } from "react";
import type { GraphEdge } from "./critical-path";
import { type GraphLayout, NODE_W, type NodePosition } from "./layout";
import type { Focus } from "./use-graph-selection";

type Box = NodePosition & { h: number };

type Props = {
  edges: readonly GraphEdge[];
  implied: readonly GraphEdge[];
  hovered: string | null;
  layout: GraphLayout;
  critical: ReadonlySet<string>;
  focus: Focus | null;
  heightOf(id: string): number;
};

function edgePath(a: Box, b: Box, relates: boolean): string {
  if (relates && Math.abs(a.x - b.x) < 1) {
    const x = a.x + NODE_W / 2;
    return a.y < b.y ? `M${x} ${a.y + a.h} V${b.y}` : `M${x} ${a.y} V${b.y + b.h}`;
  }
  const x1 = a.x + NODE_W;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
}

function ArrowMarker({ id, className }: { id: string; className: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 8 8"
      refX="7"
      refY="4"
      markerUnits="userSpaceOnUse"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M0 0 L8 4 L0 8 z" className={className} />
    </marker>
  );
}

const inFocus = (focus: Focus, id: string) => id === focus.id || focus.up.has(id) || focus.down.has(id);

export function GraphEdges({ edges, implied, hovered, layout, critical, focus, heightOf }: Props) {
  const pos = new Map<string, Box>(layout.nodes.map((n) => [n.id, { ...n, h: heightOf(n.id) }]));
  const arrow = useId();
  const hotArrow = useId();
  const shownImplied = hovered === null ? [] : implied.filter((e) => e.from === hovered || e.to === hovered);
  const draw = (e: GraphEdge, isImplied: boolean) => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) return null;
    const hot = e.type === "blocks" && critical.has(e.from) && critical.has(e.to);
    const faded = focus !== null && !(inFocus(focus, e.from) && inFocus(focus, e.to));
    return (
      <path
        key={`${e.from}-${e.to}-${e.type}`}
        d={edgePath(a, b, e.type === "relates")}
        fill="none"
        strokeWidth={hot ? 2 : 1}
        strokeDasharray={e.type === "relates" || isImplied ? "4 4" : undefined}
        data-implied={isImplied ? "true" : undefined}
        className={cn(hot ? "stroke-foreground" : "stroke-muted-foreground", faded && "opacity-20")}
        markerEnd={e.type === "blocks" ? `url(#${hot ? hotArrow : arrow})` : undefined}
      />
    );
  };
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 overflow-visible"
      width={layout.width}
      height={layout.height}
    >
      <defs>
        <ArrowMarker id={arrow} className="fill-muted-foreground" />
        <ArrowMarker id={hotArrow} className="fill-foreground" />
      </defs>
      {edges.map((e) => draw(e, false))}
      {shownImplied.map((e) => draw(e, true))}
    </svg>
  );
}
