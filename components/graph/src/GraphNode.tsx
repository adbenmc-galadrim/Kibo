import type { TicketRun, TicketView } from "@kibo/schema";
import { AgentMention, RunDot, statusCardClass, useAgentMention } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { Bot } from "lucide-react";
import { fr } from "./fr";
import { ROW_H } from "./group-layout";
import { NODE_H, NODE_W, type NodePosition } from "./layout";
import type { FocusState } from "./use-graph-selection";
import type { Point } from "./viewport";

export type NodeVariant = "card" | "pill" | "row";

const MAX_LABELS = 2;
const STARTABLE_BADGE = "h-4 shrink-0 bg-background px-1.5 text-[11px] font-medium";

type NodeProps = {
  ticket: TicketView;
  at: NodePosition;
  variant: NodeVariant;
  hot: boolean;
  run: TicketRun | null;
  selected: boolean;
  focus: FocusState;
  onSelect(id: string): void;
  onFrame(at: Point): void;
  onHover(id: string | null): void;
};

function StartableBadge() {
  return (
    <Badge variant="outline" className={STARTABLE_BADGE}>
      {fr.startable}
    </Badge>
  );
}

function CardBody({ ticket, run }: Pick<NodeProps, "ticket" | "run">) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">{ticket.keyLabel}</span>
        {ticket.startable && <StartableBadge />}
        {!run &&
          ticket.labels.slice(0, MAX_LABELS).map((label) => (
            <span key={label} className="truncate text-2xs text-muted-foreground">
              {label}
            </span>
          ))}
        <span className="flex-1" />
        {run && <RunDot state={run.state} />}
        {ticket.assignee?.kind === "agent" && (
          <Bot aria-label={fr.agent} className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </span>
      <span className="truncate text-sm font-medium">{ticket.title}</span>
    </>
  );
}

function RowBody({ ticket, run }: Pick<NodeProps, "ticket" | "run">) {
  return (
    <>
      <span className="shrink-0 font-mono text-2xs text-muted-foreground">{ticket.keyLabel}</span>
      <span className="min-w-0 flex-1 truncate text-xs">{ticket.title}</span>
      {ticket.startable && <StartableBadge />}
      {run && <RunDot state={run.state} />}
    </>
  );
}

const SHAPE: Record<NodeVariant, string> = {
  card: "grid content-center gap-1 rounded-md px-3",
  pill: "grid place-items-center rounded-full font-mono text-xl font-semibold",
  row: "flex items-center gap-2 rounded-sm px-2",
};

export function GraphNode(props: NodeProps) {
  const { ticket, at, variant, hot, run, selected, focus, onSelect, onFrame, onHover } = props;
  return (
    <button
      type="button"
      data-node={ticket.id}
      data-variant={variant}
      data-critical={hot ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      data-focus={focus ?? undefined}
      aria-label={`${ticket.keyLabel} ${ticket.title}`}
      aria-pressed={selected}
      onClick={() => onSelect(ticket.id)}
      onDoubleClick={() => onFrame(at)}
      onPointerEnter={() => onHover(ticket.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(ticket.id)}
      onBlur={() => onHover(null)}
      className={cn(
        "absolute border text-left transition-opacity hover:shadow-md",
        SHAPE[variant],
        hot && "border-2",
        ticket.statusId === "done" && "opacity-45",
        focus === "out" && "opacity-25",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        statusCardClass(ticket.statusId),
      )}
      style={{ left: at.x, top: at.y, width: NODE_W, height: variant === "row" ? ROW_H : NODE_H }}
    >
      {variant === "card" && <CardBody ticket={ticket} run={run} />}
      {variant === "pill" && ticket.keyLabel}
      {variant === "row" && <RowBody ticket={ticket} run={run} />}
    </button>
  );
}

export function NodeMention({ run, at }: { run: TicketRun; at: NodePosition }) {
  const handlers = useAgentMention();
  return (
    <div
      className="pointer-events-none absolute flex justify-end"
      style={{ left: at.x, top: at.y + 6, width: NODE_W - 32 }}
    >
      <AgentMention
        runId={run.runId}
        label={run.label}
        texts={fr.mention}
        peek={handlers.peek}
        onOpen={handlers.onOpen}
        className="pointer-events-auto max-w-28 rounded-sm bg-background/80 px-1 text-2xs"
      />
    </div>
  );
}

export function OpenButton({
  ticket,
  at,
  height,
  onOpen,
}: {
  ticket: TicketView;
  at: NodePosition;
  height: number;
  onOpen(id: string): void;
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      data-open
      className="absolute z-10 h-6 border px-2 text-2xs"
      style={{ left: at.x, top: at.y + height + 6 }}
      aria-label={fr.openTicket(ticket.keyLabel)}
      onClick={() => onOpen(ticket.id)}
    >
      {fr.openShort}
    </Button>
  );
}
