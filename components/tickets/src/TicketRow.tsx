import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { Assignee, MemberInfo, TicketRun } from "@kibo/schema";
import { AgentBadge, assigneeLabel, StatusDot, TicketKeyLabel, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { TicketNode } from "./build-tree";
import { fr } from "./fr";
import { TicketRowActions, TicketRowMenu } from "./TicketRowMenu";
import { zoneId } from "./tree-drop";

export const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_7rem_5rem_4rem] items-center gap-3 px-2 @3xl:grid-cols-[minmax(0,1fr)_7.5rem_10rem_5rem_4rem]";
export const ASSIGNEE_CELL = "hidden min-w-0 @3xl:flex";

type AssigneeProps = { assignee: Assignee | null; run: TicketRun | null; members: MemberInfo[] };

function AssigneeCell({ assignee, run, members }: AssigneeProps) {
  if (assignee?.kind === "agent" || (run && !assignee))
    return (
      <span className={cn(ASSIGNEE_CELL, "items-center")}>
        <AgentBadge
          agent={assignee?.ref ?? null}
          run={run}
          texts={fr.run}
          className="min-w-0 shrink justify-start truncate text-xs"
        />
      </span>
    );
  if (!assignee)
    return <span className={cn(ASSIGNEE_CELL, "text-xs text-muted-foreground")}>{fr.unassigned}</span>;
  const name = assigneeLabel(assignee, members);
  return (
    <span className={cn(ASSIGNEE_CELL, "items-center gap-1.5 text-xs")}>
      <span
        aria-hidden="true"
        className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-3xs font-semibold"
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

type Props = {
  node: TicketNode;
  open: boolean;
  entries: MenuEntry[];
  readOnly: boolean;
  run: TicketRun | null;
  members: MemberInfo[];
  statusLabel: string;
  onToggle(): void;
  children: ReactNode;
};

export function TicketRow({
  node,
  open,
  entries,
  readOnly,
  run,
  members,
  statusLabel,
  onToggle,
  children,
}: Props) {
  const sdk = useSdk();
  const t = node.ticket;
  const before = useDroppable({ id: zoneId({ kind: "before", ticketId: t.id }), disabled: readOnly });
  const inside = useDroppable({ id: zoneId({ kind: "inside", ticketId: t.id }), disabled: readOnly });
  const after = useDroppable({ id: zoneId({ kind: "after", ticketId: t.id }), disabled: readOnly });
  const drag = useDraggable({ id: t.id, disabled: readOnly });
  return (
    <li>
      <TicketRowMenu entries={entries}>
        <div
          className={cn(
            COLUMNS,
            "group relative h-8 rounded-md text-sm hover:bg-muted/50",
            inside.isOver && "ring-2 ring-ring",
          )}
        >
          <div
            ref={before.setNodeRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/4"
          />
          <div
            ref={inside.setNodeRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/4 h-1/2"
          />
          <div
            ref={after.setNodeRef}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4"
          />
          {before.isOver && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2 -top-px z-10 h-0.5 rounded bg-ring"
            />
          )}
          {after.isOver && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2 -bottom-px z-10 h-0.5 rounded bg-ring"
            />
          )}
          <div
            className="flex min-w-0 items-center gap-2 overflow-hidden"
            style={{ paddingLeft: node.depth * 20 }}
          >
            {node.children.length > 0 ? (
              <button
                type="button"
                className="text-muted-foreground"
                aria-label={open ? fr.collapse(t.keyLabel) : fr.expand(t.keyLabel)}
                onClick={onToggle}
              >
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <span ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes} aria-describedby={undefined}>
              <TicketKeyLabel ticket={t} className="shrink-0 font-mono text-2xs text-muted-foreground" />
            </span>
            <button
              type="button"
              className={cn("min-w-16 truncate text-left", t.statusId === "done" && "text-muted-foreground")}
              onClick={() => sdk.openTicket(t.id)}
            >
              {t.title}
            </button>
            {t.blockedReason && (
              <span className="min-w-0 truncate text-2xs text-red-600 dark:text-red-400">
                {t.blockedReason}
              </span>
            )}
            {t.waitingOn.length > 0 && (
              <Badge variant="outline" className="min-w-0 shrink justify-start text-3xs">
                <span className="truncate">{fr.waitingOn(t.waitingOn)}</span>
              </Badge>
            )}
          </div>
          <span className="flex items-center gap-2 text-xs">
            <StatusDot statusId={t.statusId} />
            <span className="truncate">{statusLabel}</span>
          </span>
          <AssigneeCell assignee={t.assignee} run={run} members={members} />
          <span className="font-mono text-2xs text-muted-foreground">
            {t.progress.total > 0 ? `${t.progress.done}/${t.progress.total}` : null}
          </span>
          <span className="flex items-center justify-end gap-0.5">
            {!readOnly && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label={fr.newSubTicket(t.keyLabel)}
                onClick={() => sdk.openNewTicket({ parentId: t.id })}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
            <TicketRowActions entries={entries} label={fr.actions(t.keyLabel)} readOnly={readOnly} />
          </span>
        </div>
      </TicketRowMenu>
      {open && node.children.length > 0 && <ul>{children}</ul>}
    </li>
  );
}
