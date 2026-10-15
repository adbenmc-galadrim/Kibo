import type { TicketRun, TicketView } from "@kibo/schema";
import { liveRun } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { useId, useRef } from "react";
import { fr } from "./fr";
import { FocusBar, Legend, ZoomControls } from "./GraphControls";
import { GraphEdges } from "./GraphEdges";
import { GraphNode, NodeMention, type NodeVariant, OpenButton } from "./GraphNode";
import { EnsembleBlock, GroupFrame, GroupNode } from "./GroupFrame";
import { type GraphModel, SEMANTIC_ZOOM, WAVE_HEADER_H } from "./graph-model";
import { ROW_H } from "./group-layout";
import { GAP_X, NODE_H, NODE_W } from "./layout";
import { Minimap } from "./Minimap";
import { boxRect, type SelectionBox, useGraphSelection } from "./use-graph-selection";
import { useGraphViewport } from "./use-graph-viewport";

type Props = {
  tickets: TicketView[];
  model: GraphModel;
  critical: ReadonlySet<string>;
  runs: ReadonlyMap<string, TicketRun>;
  compact?: boolean;
  onOpen(id: string): void;
  onToggleFrame?(value: string): void;
};

const NODE_SIZE = { width: NODE_W, height: NODE_H };
const NO_TOGGLE = () => undefined;

const HEADER_PX = 12;
const HEADER_GAP = 6;

function Headers({ model, zoom }: { model: GraphModel; zoom: number }) {
  return model.headers.map((h) => (
    <span
      key={h.x}
      title={h.label}
      className="absolute -translate-y-full truncate leading-tight text-muted-foreground"
      style={{
        left: h.x,
        top: WAVE_HEADER_H - HEADER_GAP,
        width: NODE_W + GAP_X - HEADER_GAP,
        fontSize: HEADER_PX / zoom,
      }}
    >
      {h.label}
    </span>
  ));
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

type Selection = ReturnType<typeof useGraphSelection>;

type NodesProps = Pick<Props, "tickets" | "model" | "critical" | "runs" | "onOpen"> & {
  sel: Selection;
  zoom: number;
  onToggleFrame(value: string): void;
  onFrame(at: { x: number; y: number }): void;
};

function Nodes({ tickets, model, critical, runs, onOpen, sel, zoom, onToggleFrame, onFrame }: NodesProps) {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const variantOf = (id: string): NodeVariant =>
    model.rows.has(id) ? "row" : zoom < SEMANTIC_ZOOM ? "pill" : "card";
  const heightOf = (id: string) => (model.rows.has(id) ? ROW_H : NODE_H);
  return model.layout.nodes.map((n) => {
    const group = model.groupNodes.get(n.id);
    if (group) {
      return (
        <GroupNode
          key={n.id}
          info={group}
          at={n}
          focus={sel.focusOf(n.id)}
          onToggle={onToggleFrame}
          onHover={sel.hover}
        />
      );
    }
    const block = model.blocks.get(n.id);
    if (block !== undefined) {
      return (
        <EnsembleBlock
          key={n.id}
          id={n.id}
          label={block}
          at={n}
          focus={sel.focusOf(n.id)}
          onOpen={onOpen}
          onHover={sel.hover}
        />
      );
    }
    const t = byId.get(n.id);
    if (!t) return null;
    const run = liveRun(runs.get(t.id) ?? null);
    const variant = variantOf(t.id);
    return (
      <div key={t.id} className="contents">
        <GraphNode
          ticket={t}
          at={n}
          variant={variant}
          hot={critical.has(t.id)}
          run={run}
          selected={sel.selected.has(t.id)}
          focus={sel.focusOf(t.id)}
          onSelect={sel.select}
          onFrame={onFrame}
          onHover={sel.hover}
        />
        {run && variant === "card" && <NodeMention run={run} at={n} />}
        {sel.selected.has(t.id) && <OpenButton ticket={t} at={n} height={heightOf(t.id)} onOpen={onOpen} />}
      </div>
    );
  });
}

function Overlay({
  tickets,
  sel,
  compact,
  zoomedOut,
}: {
  tickets: TicketView[];
  sel: Selection;
  compact: boolean;
  zoomedOut: boolean;
}) {
  const focused = sel.focus ? tickets.find((t) => t.id === sel.focus?.id) : undefined;
  if (!compact && sel.focus && focused) {
    return (
      <FocusBar
        keyLabel={focused.keyLabel}
        title={focused.title}
        up={sel.focus.up.size}
        down={sel.focus.down.size}
      />
    );
  }
  return (
    <>
      <Legend compact={compact} />
      {!compact && zoomedOut && (
        <span className="pointer-events-none absolute right-36 bottom-5 text-2xs text-muted-foreground">
          {fr.zoomHint}
        </span>
      )}
    </>
  );
}

export function GraphCanvas(props: Props) {
  const { tickets, model, critical, runs, compact = false, onOpen, onToggleFrame = NO_TOGGLE } = props;
  const { layout } = model;
  const section = useRef<HTMLElement>(null);
  const help = useId();
  const vp = useGraphViewport(section, layout);
  const { view } = vp;
  const sel = useGraphSelection({ layout, edges: model.edges, view, onOpen });
  const anchorHeight = new Map(model.anchors.map((a) => [a.id, a.height]));
  const linked = { ...layout, nodes: [...layout.nodes, ...model.anchors] };
  const heightOf = (id: string) => anchorHeight.get(id) ?? (model.rows.has(id) ? ROW_H : NODE_H);

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
        <Headers model={model} zoom={view.zoom} />
        {model.frames.map((f) => (
          <GroupFrame key={f.id} frame={f} onToggle={onToggleFrame} onOpen={onOpen} />
        ))}
        <GraphEdges
          edges={model.edges}
          implied={model.implied}
          hovered={sel.hovered}
          layout={linked}
          critical={critical}
          focus={sel.focus}
          heightOf={heightOf}
        />
        <Nodes
          tickets={tickets}
          model={model}
          critical={critical}
          runs={runs}
          onOpen={onOpen}
          sel={sel}
          zoom={view.zoom}
          onToggleFrame={onToggleFrame}
          onFrame={(at) => vp.frame(at, NODE_SIZE)}
        />
      </div>
      {sel.box && <BoxOverlay box={sel.box} />}
      <output className="sr-only">{sel.selected.size > 1 ? fr.selected(sel.selected.size) : ""}</output>
      <Overlay tickets={tickets} sel={sel} compact={compact} zoomedOut={view.zoom < SEMANTIC_ZOOM} />
      {!compact && <Minimap layout={layout} view={view} box={vp.box} onJump={vp.centerOn} />}
      <ZoomControls zoom={view.zoom} onZoom={vp.zoomTo} onFit={vp.fit} />
    </section>
  );
}
