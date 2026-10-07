import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type QueueEntry, type RunView, runSubject } from "@kibo/schema";
import { RUN_TEXT } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { fr } from "../i18n/fr";
import { queueHint } from "./format";

type Props = {
  run: RunView;
  entry: QueueEntry;
  prev: QueueEntry | null;
  next: QueueEntry | null;
  onMove: (index: number) => void;
  onPriority: (priority: boolean) => void;
  onCancel: () => void;
};

export function QueueItem({ run, entry, prev, next, onMove, onPriority, onCancel }: Props) {
  const drag = useDraggable({ id: run.id });
  const drop = useDroppable({ id: run.id });
  const style = drag.transform
    ? { transform: `translate(${drag.transform.x}px, ${drag.transform.y}px)` }
    : undefined;
  return (
    <li
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      style={style}
      data-queued="true"
      data-run={run.id}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs",
        drop.isOver && !drag.isDragging && "ring-2 ring-cyan-500/60",
      )}
    >
      <button
        type="button"
        aria-label={fr.queue.drag(run.ticketKey ?? run.ticketTitle)}
        className="shrink-0 cursor-grab text-muted-foreground"
        {...drag.listeners}
        {...drag.attributes}
      >
        <GripVertical className="size-3.5" />
      </button>
      <span className={cn("shrink-0 rounded bg-cyan-500/15 px-1 font-mono text-3xs", RUN_TEXT.queued)}>
        {`#${entry.position}`}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 break-words" title={runSubject(run)}>
          {runSubject(run)}
        </span>
        <span className="line-clamp-2 break-words text-3xs text-muted-foreground">
          {queueHint(run, entry.reason)}
        </span>
      </span>
      {run.priority && (
        <Badge
          variant="outline"
          className="shrink-0 px-1 text-3xs border-brand/40 text-brand-strong dark:text-brand"
        >
          {fr.queue.priority}
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-5 shrink-0"
            aria-label={fr.queue.actions(run.ticketKey ?? run.ticketTitle)}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={prev === null} onSelect={() => prev && onMove(prev.position - 1)}>
            {fr.queue.moveUp}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={next === null} onSelect={() => next && onMove(next.position - 1)}>
            {fr.queue.moveDown}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPriority(!run.priority)}>
            {run.priority ? fr.queue.unprioritize : fr.queue.prioritize}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onCancel}>
            {fr.queue.cancel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
