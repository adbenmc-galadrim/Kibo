import { useSortable } from "@dnd-kit/sortable";
import type { CiRun, MemberInfo, Status, StatusId, TicketRun, TicketView } from "@kibo/schema";
import { AgentBadge, assigneeLabel, type CiTone, TicketKeyLabel, worstCiTone } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@kibo/sdk/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@kibo/sdk/ui/dropdown-menu";
import { ContextMenuEntries, DropdownMenuEntries } from "@kibo/sdk/ui/menu-entries";
import { Bot, MoreHorizontal } from "lucide-react";
import type { PointerEvent } from "react";
import { cardMenuEntries } from "./card-menu";
import { fr } from "./fr";

const CI_DOT = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  running: "bg-amber-500",
  neutral: "bg-muted-foreground/60",
} as const satisfies Record<CiTone, string>;

export type CiChip = { tone: CiTone; prNumber: number | null };

export function ciChipOf(runs: CiRun[]): CiChip | undefined {
  const tone = worstCiTone(runs);
  if (tone === null) return undefined;
  const latest = [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return { tone, prNumber: latest?.prNumber ?? null };
}

const stopDrag = (e: PointerEvent) => e.stopPropagation();

type Props = {
  ticket: TicketView;
  run: TicketRun | null;
  ci?: CiChip;
  selected: boolean | null;
  statuses: Status[];
  members: MemberInfo[];
  remote: { label: string; state: string }[];
  readOnly: boolean;
  onOpen: () => void;
  onMove: (statusId: StatusId) => void;
  onRemove: () => void;
};

export function KanbanCard(props: Props) {
  const {
    ticket: t,
    run,
    ci,
    selected,
    statuses,
    members,
    remote,
    readOnly,
    onOpen,
    onMove,
    onRemove,
  } = props;
  const sortable = useSortable({ id: t.id, disabled: readOnly, attributes: { role: "article" } });
  const { attributes, listeners, transform, transition, isDragging } = sortable;
  const ref = (node: HTMLElement | null) => {
    sortable.setNodeRef(node);
    sortable.setActivatorNodeRef(node);
  };
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : isDragging
        ? "translate3d(var(--drag-x, 0), var(--drag-y, 0), 0)"
        : undefined,
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
            "relative grid gap-2 rounded-md border bg-card p-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !readOnly && "cursor-grab touch-none",
            isDragging && "z-10 cursor-grabbing shadow-lg ring-1 ring-ring",
            insertion &&
              "before:-top-1.5 before:absolute before:inset-x-1 before:h-0.5 before:rounded-full before:bg-ring",
            t.key === null && "border-dashed",
            selected === true && "ring-2 ring-ring ring-inset",
            selected === false && "opacity-50",
          )}
        >
          <div className="flex h-6 items-center gap-2">
            <TicketKeyLabel ticket={t} className="font-mono text-2xs text-muted-foreground" />
            <span className="flex-1" />
            {!readOnly && (
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
            )}
          </div>
          <button type="button" className="w-fit cursor-pointer text-left" onClick={onOpen}>
            {t.title}
          </button>
          {t.blockedReason && (
            <p className="text-2xs text-red-600 dark:text-red-400">{fr.blockedReason(t.blockedReason)}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <AgentBadge
              agent={t.assignee?.kind === "agent" ? t.assignee.ref : null}
              run={run}
              texts={fr.run}
            />
            {remote.map((r) => (
              <span
                key={r.label}
                className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-1.5 py-0.5 text-3xs text-brand-strong dark:text-brand"
              >
                <Bot aria-hidden className="size-3" />
                {r.label}
              </span>
            ))}
            {t.assignee?.kind === "human" && members.length > 0 && (
              <Badge variant="outline" className="text-3xs font-normal">
                {assigneeLabel(t.assignee, members)}
              </Badge>
            )}
            {t.waitingOn.map((k) => (
              <Badge key={k} variant="outline" className="text-3xs">
                {fr.waitingOn(k)}
              </Badge>
            ))}
            {ci && (
              <span
                title={fr.ci[ci.tone]}
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-3xs"
              >
                <span
                  role="img"
                  aria-label={fr.ci[ci.tone]}
                  className={`size-2 rounded-full ${CI_DOT[ci.tone]}`}
                />
                {ci.prNumber !== null && `#${ci.prNumber}`}
              </span>
            )}
            {t.progress.total > 0 && (
              <span className="ml-auto font-mono text-3xs text-muted-foreground">{`${t.progress.done}/${t.progress.total}`}</span>
            )}
          </div>
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuEntries entries={entries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
