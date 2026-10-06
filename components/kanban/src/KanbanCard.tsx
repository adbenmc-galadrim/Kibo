import { useSortable } from "@dnd-kit/sortable";
import type { Status, StatusId } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries } from "@kibo/sdk/ui/menu-entries";
import { MoreHorizontal } from "lucide-react";
import type { PointerEvent } from "react";
import { cardMenuEntries } from "./card-menu";
import { fr } from "./fr";
import { CARD_CLASS, type CardFacts, KanbanCardContent } from "./KanbanCardContent";

const stopDrag = (e: PointerEvent) => e.stopPropagation();

type Props = CardFacts & {
  selected: boolean | null;
  statuses: Status[];
  readOnly: boolean;
  onOpen: () => void;
  onMove: (statusId: StatusId) => void;
  onRemove: () => void;
};

export function KanbanCard(props: Props) {
  const { ticket: t, selected, statuses, readOnly, onOpen, onMove, onRemove } = props;
  const sortable = useSortable({ id: t.id, disabled: readOnly, attributes: { role: "article" } });
  const { attributes, listeners, transform, transition, isDragging } = sortable;
  const ref = (node: HTMLElement | null) => {
    sortable.setNodeRef(node);
    sortable.setActivatorNodeRef(node);
  };
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };
  const insertion =
    sortable.isOver && sortable.active !== null && !sortable.items.includes(String(sortable.active.id));
  const entries = cardMenuEntries({
    ticket: t,
    statuses,
    readOnly,
    texts: fr,
    actions: { open: onOpen, move: onMove, remove: onRemove },
  });
  const menu = !readOnly && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={fr.actions(t.keyLabel)}
          data-dnd-ignore="true"
          onPointerDown={stopDrag}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const title = (
    <button type="button" className="w-fit cursor-pointer text-left" onClick={onOpen}>
      {t.title}
    </button>
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          ref={ref}
          style={style}
          {...attributes}
          {...listeners}
          tabIndex={readOnly ? undefined : attributes.tabIndex}
          aria-label={`${t.keyLabel} ${t.title}`}
          data-key={t.keyLabel}
          data-selected={selected === true}
          className={cn(
            CARD_CLASS,
            !readOnly && "cursor-grab touch-none",
            isDragging && "opacity-40",
            insertion &&
              "before:-top-1.5 before:absolute before:inset-x-1 before:h-0.5 before:rounded-full before:bg-ring",
            t.key === null && "border-dashed",
            selected === true && "ring-2 ring-ring ring-inset",
            selected === false && !isDragging && "opacity-50",
          )}
        >
          <KanbanCardContent {...props} menu={menu} title={title} />
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
