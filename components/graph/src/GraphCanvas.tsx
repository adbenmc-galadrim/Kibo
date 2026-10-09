import type { TicketRun, TicketView } from "@kibo/schema";
import { liveRun, RunDot, StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Bot } from "lucide-react";
import { useId, useRef } from "react";
import type { GraphEdge } from "./critical-path";
import { fr } from "./fr";
import { Legend, ZoomControls } from "./GraphControls";
import { type GraphLayout, NODE_H, NODE_W, type NodePosition } from "./layout";
import { Minimap } from "./Minimap";
import { boxRect, type SelectionBox, useGraphSelection } from "./use-graph-selection";
import { useGraphViewport } from "./use-graph-viewport";
import type { Point } from "./viewport";

type Props = {
  tickets: TicketView[];
  edges: GraphEdge[];
  layout: GraphLayout;
  critical: ReadonlySet<string>;
  runs: ReadonlyMap<string, TicketRun>;
  compact?: boolean;
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

type NodeProps = {
  ticket: TicketView;
  at: NodePosition;
  hot: boolean;
  run: TicketRun | null;
  selected: boolean;
  neighbor: boolean;
  dimmed: boolean;
  onSelect(id: string): void;
  onFrame(at: Point): void;
};

function OpenButton({
  ticket,
  at,
  onOpen,
}: {
  ticket: TicketView;
  at: NodePosition;
  onOpen(id: string): void;
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      data-open
      className="absolute h-6 border px-2 text-2xs"
      style={{ left: at.x, top: at.y + NODE_H + 6 }}
      aria-label={fr.openTicket(ticket.keyLabel)}
      onClick={() => onOpen(ticket.id)}
    >
      {fr.openShort}
    </Button>
  );
}

function Node({ ticket, at, hot, run, selected, neighbor, dimmed, onSelect, onFrame }: NodeProps) {
  return (
    <button
      type="button"
      data-node={ticket.id}
      data-critical={hot ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      data-neighbor={neighbor ? "true" : "false"}
      aria-label={`${ticket.keyLabel} ${ticket.title}`}
      aria-pressed={selected}
      onClick={() => onSelect(ticket.id)}
      onDoubleClick={() => onFrame(at)}
      className={cn(
        "absolute grid content-center gap-1 rounded-md border bg-card px-3 text-left transition-opacity hover:bg-accent",
        hot && "border-2 border-foreground",
        ticket.statusId === "done" && "opacity-45",
        dimmed && "opacity-60",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
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

function BoxOverlay({ box }: { box: SelectionBox }) {
  const r = boxRect(box);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-sm border border-dashed border-ring bg-accent/30"
      style={{ left: r.left, top: r.top, width: r.right - r.left, height: r.bottom - r.top }}
    />
  );
}

export function GraphCanvas({ tickets, edges, layout, critical, runs, compact = false, onOpen }: Props) {
  const section = useRef<HTMLElement>(null);
  const help = useId();
  const vp = useGraphViewport(section, layout);
  const { view } = vp;
  const sel = useGraphSelection({ layout, edges, view, onOpen });
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const isDimmed = (id: string) => sel.selected.size > 0 && !sel.selected.has(id) && !sel.related.has(id);

  return (
    <section
      ref={section}
      aria-label={fr.canvas}
      aria-describedby={help}
      data-zoom={String(view.zoom)}
      className={cn(
        "relative h-full cursor-grab touch-none select-none overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] active:cursor-grabbing",
        !compact && "min-h-[320px]",
      )}
      onKeyDown={sel.onKeyDown}
      onPointerDown={(e) => {
        if (!sel.pointer.onPointerDown(e)) vp.pointer.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        if (!sel.pointer.onPointerMove(e)) vp.pointer.onPointerMove(e);
      }}
      onPointerUp={() => {
        if (!sel.pointer.onPointerUp()) vp.pointer.onPointerUp();
      }}
    >
      <p id={help} className="sr-only">
        {fr.graphHelp}
      </p>
      <div
        data-stage
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
          width: layout.width,
          height: layout.height,
        }}
      >
        {layout.isolatedTop !== null && (
          <span
            className="absolute left-0 text-2xs text-muted-foreground uppercase tracking-wide"
            style={{ top: layout.isolatedTop - 20 }}
          >
            {fr.isolated}
          </span>
        )}
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
              selected={sel.selected.has(t.id)}
              neighbor={sel.related.has(t.id)}
              dimmed={isDimmed(t.id)}
              onSelect={sel.select}
              onFrame={(at) => vp.frame(at, NODE_SIZE)}
            />
          ) : null;
        })}
        {layout.nodes.map((n) => {
          const t = byId.get(n.id);
          return t && sel.selected.has(t.id) ? (
            <OpenButton key={`open-${t.id}`} ticket={t} at={n} onOpen={onOpen} />
          ) : null;
        })}
      </div>
      {sel.box && <BoxOverlay box={sel.box} />}
      <output className="sr-only">{sel.selected.size > 1 ? fr.selected(sel.selected.size) : ""}</output>
      <Legend compact={compact} />
      {!compact && <Minimap layout={layout} view={view} box={vp.box} onJump={vp.centerOn} />}
      <ZoomControls zoom={view.zoom} onZoom={vp.zoomTo} onFit={vp.fit} />
    </section>
  );
}
