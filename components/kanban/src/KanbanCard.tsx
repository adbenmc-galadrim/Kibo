import { useSortable } from "@dnd-kit/sortable";
import { isActiveT3Status, type ProjectInfo, type Status, type StatusId } from "@kibo/schema";
import { stepTitle, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { LaunchInT3Button } from "@kibo/sdk/t3";
import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries } from "@kibo/sdk/ui/menu-entries";
import { MoreHorizontal } from "lucide-react";
import { type PointerEvent, useState } from "react";
import { CardTooltip } from "./CardTooltip";
import { cardMenuEntries } from "./card-menu";
import { fr } from "./fr";
import { CARD_CLASS, CARD_TITLE_CLASS, type CardFacts, KanbanCardContent } from "./KanbanCardContent";

const stopDrag = (e: PointerEvent) => e.stopPropagation();

const REVEAL_CLASS =
  "-mt-2 h-0 overflow-hidden group-hover/card:mt-0 group-hover/card:h-auto group-hover/card:overflow-visible group-focus-within/card:mt-0 group-focus-within/card:h-auto group-focus-within/card:overflow-visible";

type Props = CardFacts & {
  selected: boolean | null;
  statuses: Status[];
  project?: Pick<ProjectInfo, "id" | "hasFolder"> | null;
  onOpen: () => void;
  onMove: (statusId: StatusId) => void;
  onRemove: () => void;
};

export function KanbanCard(props: Props) {
  const { ticket: t, selected, statuses, onOpen, onMove, onRemove, project = null } = props;
  const sdk = useSdk();
  const sortable = useSortable({ id: t.id, attributes: { role: "article" } });
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
  const [menuOpen, setMenuOpen] = useState(false);
  const entries = cardMenuEntries({
    ticket: t,
    statuses,
    texts: fr,
    sdk,
    actions: { open: onOpen, move: onMove, remove: onRemove },
  });
  const menu = (
    <DropdownMenu onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={fr.actions(t.keyLabel)}
          data-dnd-ignore="true"
          onPointerDown={stopDrag}
        >
          <MoreHorizontal absoluteStrokeWidth size={14} className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuEntries entries={entries} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const title = (
    <button type="button" className={cn(CARD_TITLE_CLASS, "cursor-pointer")} onClick={onOpen}>
      {stepTitle(t, props.group)}
    </button>
  );
  const threadActive = t.thread !== null && isActiveT3Status(t.thread.status);
  const launch = t.startable &&
    !threadActive &&
    t.key !== null &&
    project !== null &&
    sortable.active === null && (
      <div data-dnd-ignore="true" className={REVEAL_CLASS} onPointerDown={stopDrag}>
        <LaunchInT3Button
          projectId={project.id}
          ticketKey={t.key}
          done={false}
          thread={null}
          folderMissing={!project.hasFolder}
          size="xs"
        />
      </div>
    );
  return (
    <ContextMenu>
      <CardTooltip ticket={t} suppressed={sortable.active !== null || menuOpen}>
        <ContextMenuTrigger asChild>
          <article
            ref={ref}
            style={style}
            {...attributes}
            {...listeners}
            tabIndex={attributes.tabIndex}
            aria-label={`${t.keyLabel} ${t.title}`}
            data-key={t.keyLabel}
            data-selected={selected === true}
            className={cn(
              CARD_CLASS,
              "group/card cursor-grab touch-none",
              launch && "hover:border-foreground/70 focus-within:border-foreground/70",
              isDragging && "opacity-40",
              insertion &&
                "before:-top-1.5 before:absolute before:inset-x-1 before:h-0.5 before:rounded-full before:bg-ring",
              t.key === null && "border-dashed",
              t.session && "border-(--tracking-brand-line)",
              selected === true && "ring-2 ring-ring ring-inset",
              selected === false && !isDragging && "opacity-50",
            )}
          >
            <KanbanCardContent {...props} menu={menu} title={title} launch={launch} />
          </article>
        </ContextMenuTrigger>
      </CardTooltip>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
