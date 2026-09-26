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
import { reasonText } from "./format";

type Props = {
  run: RunView;
  entry: QueueEntry;
  count: number;
  onMove: (index: number) => void;
  onPriority: (priority: boolean) => void;
  onCancel: () => void;
};

export function QueueItem({ run, entry, count, onMove, onPriority, onCancel }: Props) {
  const drag = useDraggable({ id: run.id });
  const drop = useDroppable({ id: run.id });
  const index = entry.position - 1;
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
        "flex items-center gap-2 rounded-md border border-dashed p-2 text-sm",
        drop.isOver && !drag.isDragging && "ring-2 ring-cyan-500/60",
      )}
    >
      <button
        type="button"
        aria-label={fr.queue.drag(run.ticketKey ?? run.ticketTitle)}
        className="cursor-grab text-muted-foreground"
        {...drag.listeners}
        {...drag.attributes}
      >
        <GripVertical className="size-3.5" />
      </button>
      <span className={cn("rounded bg-cyan-500/15 px-1 font-mono text-xs", RUN_TEXT.queued)}>
        {`#${entry.position}`}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="break-words">{runSubject(run)}</span>
        <span className="text-xs text-muted-foreground">
          {run.pendingAnswer ? fr.queue.resumeHint : reasonText(entry.reason)}
        </span>
      </span>
      {run.priority && (
        <Badge variant="outline" className="border-brand/40 text-brand-strong dark:text-brand">
          {fr.queue.priority}
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label={fr.queue.actions(run.ticketKey ?? run.ticketTitle)}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
            {fr.queue.moveUp}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(index + 1)}>
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
