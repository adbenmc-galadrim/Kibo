import { useDroppable } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { Status } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "./fr";

type Props = {
  status: Status;
  ids: string[];
  targeted: boolean;
  forbidden?: boolean;
  children: ReactNode;
  onAdd?: () => void;
};

export function KanbanColumn({ status, ids, targeted, forbidden = false, children, onAdd }: Props) {
  const { setNodeRef } = useDroppable({ id: status.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={status.label}
      data-forbidden={forbidden || undefined}
      className={cn(
        "flex min-h-0 min-w-[180px] flex-1 flex-col rounded-lg bg-muted/40 p-2 transition-opacity",
        targeted && "ring-2 ring-ring",
        forbidden && "cursor-not-allowed opacity-50",
        forbidden && targeted && "ring-destructive/60",
      )}
    >
      <header className="flex h-7 items-center gap-2 px-1 text-xs">
        <StatusDot statusId={status.id} />
        <span className="font-medium">{status.label}</span>
        <span className="flex-1" />
        <span className="font-mono text-2xs text-muted-foreground">{ids.length}</span>
        {onAdd ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label={fr.newTicketIn(status.label)}
            onClick={onAdd}
          >
            <Plus absoluteStrokeWidth size={14} className="size-3.5" />
          </Button>
        ) : (
          <span className="size-6" />
        )}
      </header>
      <div
        data-slot="kanban-cards"
        className="scrollbar-none flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto pt-2"
      >
        <SortableContext id={status.id} items={ids}>
          {children}
        </SortableContext>
      </div>
    </section>
  );
}
