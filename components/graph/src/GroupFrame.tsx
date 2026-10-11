import { cn } from "@kibo/sdk/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fr } from "./fr";
import type { FrameBox, GroupNodeInfo } from "./group-layout";
import { NODE_H, NODE_W, type NodePosition } from "./layout";
import type { FocusState } from "./use-graph-selection";

const TOGGLE = "flex min-w-0 items-center gap-1.5 rounded-sm text-left text-sm font-semibold hover:underline";

export function GroupFrame({ frame, onToggle }: { frame: FrameBox; onToggle(value: string): void }) {
  return (
    <div
      data-frame={frame.value}
      className="absolute rounded-lg border border-dashed border-muted-foreground/50 bg-background/40"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    >
      <div className="flex h-9 items-center px-2.5">
        <button
          type="button"
          aria-expanded
          aria-label={fr.collapseFrame(frame.value)}
          className={TOGGLE}
          onClick={() => onToggle(frame.value)}
        >
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{frame.label}</span>
        </button>
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
      data-group={info.value}
      aria-expanded={false}
      aria-label={fr.expandFrame(info.value)}
      onClick={() => onToggle(info.value)}
      onPointerEnter={() => onHover(at.id)}
      onPointerLeave={() => onHover(null)}
      className={cn(
        "absolute flex items-center gap-1.5 rounded-lg border bg-card px-3 text-left text-sm font-semibold transition-opacity hover:shadow-md",
        focus === "out" && "opacity-25",
      )}
      style={{ left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
    >
      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{info.label}</span>
    </button>
  );
}
