import type { TicketRun, TicketView } from "@kibo/schema";
import { liveRun, RunDot, StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Bot } from "lucide-react";
import { useId, useRef } from "react";
import type { GraphEdge } from "./critical-path";
import { fr } from "./fr";
import { Legend, ZoomControls } from "./GraphControls";
import { type GraphLayout, NODE_H, NODE_W, type NodePosition } from "./layout";
import { Minimap } from "./Minimap";
import { useGraphViewport } from "./use-graph-viewport";
import type { Point } from "./viewport";

type Props = {
  tickets: TicketView[];
  edges: GraphEdge[];
  layout: GraphLayout;
  critical: ReadonlySet<string>;
  runs: ReadonlyMap<string, TicketRun>;
  onOpen(id: string): void;
};

const NODE_SIZE = { width: NODE_W, height: NODE_H };

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
      markerUnits="userSpaceOnUse"
      markerWidth="7"
      markerHeight="7"
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
  run,
  onOpen,
  onFrame,
}: {
  ticket: TicketView;
  at: NodePosition;
  hot: boolean;
  run: TicketRun | null;
  onOpen(id: string): void;
  onFrame(at: Point): void;
}) {
  return (
    <button
      type="button"
      data-critical={hot ? "true" : "false"}
      aria-label={`${ticket.keyLabel} ${ticket.title}`}
      onClick={() => onOpen(ticket.id)}
      onDoubleClick={() => onFrame(at)}
      className={cn(
        "absolute grid content-center gap-1 rounded-md border bg-card px-3 text-left hover:bg-accent",
        hot && "border-2 border-foreground",
        ticket.statusId === "done" && "opacity-45",
      )}
      style={{ left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
    >
      <span className="flex items-center gap-1.5">
        <StatusDot statusId={ticket.statusId} />
        <span className="font-mono text-2xs text-muted-foreground">{ticket.keyLabel}</span>
        <span className="flex-1" />
        {run && <RunDot state={run.state} />}
        {ticket.assignee?.kind === "agent" && (
          <Bot aria-label={fr.agent} className="size-3.5 text-muted-foreground" />
        )}
      </span>
      <span className="truncate text-sm font-medium">{ticket.title}</span>
    </button>
  );
}

export function GraphCanvas({ tickets, edges, layout, critical, runs, onOpen }: Props) {
  const section = useRef<HTMLElement>(null);
  const vp = useGraphViewport(section, layout);
  const { view } = vp;
  const byId = new Map(tickets.map((t) => [t.id, t]));

  return (
    <section
      ref={section}
      aria-label={fr.canvas}
      data-zoom={String(view.zoom)}
      className="relative h-full min-h-[320px] cursor-grab touch-none overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] active:cursor-grabbing"
      {...vp.pointer}
    >
      <div
        data-stage
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
          width: layout.width,
          height: layout.height,
        }}
      >
        <Edges edges={edges} layout={layout} critical={critical} />
        {layout.nodes.map((n) => {
          const t = byId.get(n.id);
          return t ? (
            <Node
              key={t.id}
              ticket={t}
              at={n}
              hot={critical.has(t.id)}
              run={liveRun(runs.get(t.id) ?? null)}
              onOpen={onOpen}
              onFrame={(at) => vp.frame(at, NODE_SIZE)}
            />
          ) : null;
        })}
      </div>
      <Legend />
      <Minimap layout={layout} view={view} box={vp.box} onJump={vp.centerOn} />
      <ZoomControls zoom={view.zoom} onZoom={vp.zoomTo} onFit={vp.fit} />
    </section>
  );
}
