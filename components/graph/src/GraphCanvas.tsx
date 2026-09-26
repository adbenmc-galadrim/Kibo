import type { TicketView } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Bot, Minus, Plus } from "lucide-react";
import { type PointerEvent, useId, useRef, useState } from "react";
import type { GraphEdge } from "./critical-path";
import { fr } from "./fr";
import { type GraphLayout, NODE_H, NODE_W, type NodePosition } from "./layout";

type Props = {
  tickets: TicketView[];
  edges: GraphEdge[];
  layout: GraphLayout;
  critical: ReadonlySet<string>;
  onOpen(id: string): void;
};

type Point = { x: number; y: number };

const MARGIN = 48;
const clampZoom = (z: number) => Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));

function edgePath(a: Point, b: Point, relates: boolean): string {
  if (relates && Math.abs(a.x - b.x) < 1) {
    const x = a.x + NODE_W / 2;
    return a.y < b.y ? `M${x} ${a.y + NODE_H} V${b.y}` : `M${x} ${a.y} V${b.y + NODE_H}`;
  }
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
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
      markerWidth="8"
      markerHeight="8"
      orient="auto-start-reverse"
    >
      <path d="M0 0 L8 4 L0 8 z" className={className} />
    </marker>
  );
}

function Edges({ edges, layout, critical }: Pick<Props, "edges" | "layout" | "critical">) {
  const pos = new Map<string, NodePosition>(layout.nodes.map((n) => [n.id, n]));
  const arrow = useId();
  const hotArrow = useId();
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
      {edges.map((e) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const hot = e.type === "blocks" && critical.has(e.from) && critical.has(e.to);
        return (
          <path
            key={`${e.from}-${e.to}-${e.type}`}
            d={edgePath(a, b, e.type === "relates")}
            fill="none"
            strokeWidth={hot ? 2 : 1}
            strokeDasharray={e.type === "relates" ? "4 4" : undefined}
            className={hot ? "stroke-foreground" : "stroke-muted-foreground"}
            markerEnd={e.type === "blocks" ? `url(#${hot ? hotArrow : arrow})` : undefined}
          />
        );
      })}
    </svg>
  );
}

function Node({
  ticket,
  at,
  hot,
  onOpen,
}: {
  ticket: TicketView;
  at: NodePosition;
  hot: boolean;
  onOpen(id: string): void;
}) {
  return (
    <button
      type="button"
      data-critical={hot ? "true" : "false"}
      aria-label={`${ticket.key} ${ticket.title}`}
      onClick={() => onOpen(ticket.id)}
      className={cn(
        "absolute grid content-center gap-1 rounded-md border bg-card px-3 text-left hover:bg-accent",
        hot && "border-2 border-foreground",
        ticket.statusId === "done" && "opacity-45",
      )}
      style={{ left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
    >
      <span className="flex items-center gap-1.5">
        <StatusDot statusId={ticket.statusId} />
        <span className="font-mono text-xs text-muted-foreground">{ticket.key}</span>
        <span className="flex-1" />
        {ticket.assignee?.kind === "agent" && (
          <Bot aria-label={fr.agent} className="size-3.5 text-muted-foreground" />
        )}
      </span>
      <span className="truncate text-sm font-medium">{ticket.title}</span>
    </button>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 grid gap-1 rounded-md border bg-card p-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-px w-5 bg-muted-foreground" />
        {fr.legend.blocks}
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-5 bg-foreground" />
        {fr.legend.critical}
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="w-5 border-t border-dashed border-muted-foreground" />
        {fr.legend.relates}
      </span>
    </div>
  );
}

function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom(z: number): void }) {
  return (
    <div className="absolute right-3 bottom-3 flex items-center rounded-md border bg-card">
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={fr.zoomIn}
        onClick={() => onZoom(clampZoom(zoom + 0.1))}
      >
        <Plus aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        className="h-7 px-2 font-mono text-xs"
        aria-label={fr.zoomReset}
        onClick={() => onZoom(1)}
      >
        {`${Math.round(zoom * 100)} %`}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={fr.zoomOut}
        onClick={() => onZoom(clampZoom(zoom - 0.1))}
      >
        <Minus aria-hidden="true" />
      </Button>
    </div>
  );
}

export function GraphCanvas({ tickets, edges, layout, critical, onOpen }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const drag = useRef<{ start: Point; from: Point } | null>(null);
  const byId = new Map(tickets.map((t) => [t.id, t]));

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.target instanceof Element && e.target.closest("button")) return;
    drag.current = { start: { x: e.clientX, y: e.clientY }, from: pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d) setPan({ x: d.from.x + e.clientX - d.start.x, y: d.from.y + e.clientY - d.start.y });
  };

  return (
    <section
      aria-label={fr.canvas}
      className="relative h-full min-h-[320px] cursor-grab overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${pan.x + MARGIN}px, ${pan.y + MARGIN}px) scale(${zoom})`,
          width: layout.width,
          height: layout.height,
        }}
      >
        <Edges edges={edges} layout={layout} critical={critical} />
        {layout.nodes.map((n) => {
          const t = byId.get(n.id);
          return t ? <Node key={t.id} ticket={t} at={n} hot={critical.has(t.id)} onOpen={onOpen} /> : null;
        })}
      </div>
      <Legend />
      <ZoomControls zoom={zoom} onZoom={setZoom} />
    </section>
  );
}
