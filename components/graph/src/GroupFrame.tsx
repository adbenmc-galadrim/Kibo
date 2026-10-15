import { cn } from "@kibo/sdk/lib/utils";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { fr } from "./fr";
import type { FrameBox, GroupNodeInfo } from "./group-layout";
import { NODE_H, NODE_W, type NodePosition } from "./layout";
import type { FocusState } from "./use-graph-selection";

const TOGGLE = "flex min-w-0 items-center gap-1.5 rounded-sm text-left text-sm font-semibold hover:underline";
const DASHED = "border border-dashed border-zinc-400 dark:border-zinc-600";

type FrameProps = { frame: FrameBox; onToggle(value: string): void; onOpen(id: string): void };

export function GroupFrame({ frame, onToggle, onOpen }: FrameProps) {
  const ticketId = frame.ticketId;
  return (
    <div
      data-frame={frame.name}
      className={cn("absolute rounded-lg bg-background/40", DASHED)}
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <div className="flex h-9 items-center gap-1 px-2.5">
        <button
          type="button"
          aria-expanded
          aria-label={fr.collapseFrame(frame.name)}
          title={frame.label}
          className={TOGGLE}
          onClick={() => onToggle(frame.value)}
        >
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{frame.label}</span>
        </button>
        {ticketId !== null && (
          <button
            type="button"
            aria-label={fr.openEnsemble(frame.name)}
            className="ml-auto shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpen(ticketId)}
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

type GroupNodeProps = {
  info: GroupNodeInfo;
  at: NodePosition;
  focus: FocusState;
  onToggle(value: string): void;
  onHover(id: string | null): void;
};

export function GroupNode({ info, at, focus, onToggle, onHover }: GroupNodeProps) {
  return (
    <button
      type="button"
      data-group={info.name}
      aria-expanded={false}
      aria-label={fr.expandFrame(info.name)}
      onClick={() => onToggle(info.value)}
      onPointerEnter={() => onHover(at.id)}
      onPointerLeave={() => onHover(null)}
      className={cn(
        "absolute flex items-center gap-1.5 rounded-lg bg-card px-3 text-left text-sm font-semibold transition-opacity hover:shadow-md",
        DASHED,
        focus === "out" && "opacity-25",
      )}
      style={{ left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
    >
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{info.label}</span>
    </button>
  );
}

type BlockProps = {
  id: string;
  label: string;
  at: NodePosition;
  focus: FocusState;
  onOpen(id: string): void;
  onHover(id: string | null): void;
};

export function EnsembleBlock({ id, label, at, focus, onOpen, onHover }: BlockProps) {
  return (
    <button
      type="button"
      data-ensemble={label}
      aria-label={fr.openEnsemble(label)}
      onClick={() => onOpen(id)}
      onPointerEnter={() => onHover(at.id)}
      onPointerLeave={() => onHover(null)}
      className={cn(
        "absolute flex items-center rounded-lg bg-card px-3 text-left font-mono text-xs font-semibold transition-opacity hover:shadow-md",
        DASHED,
        focus === "out" && "opacity-25",
      )}
      style={{ left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
