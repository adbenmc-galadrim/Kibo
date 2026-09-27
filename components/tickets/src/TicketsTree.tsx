import type { Assignee, MemberInfo, Status, TicketRun } from "@kibo/schema";
import {
  AgentBadge,
  assigneeLabel,
  filterBySource,
  readSource,
  StatusDot,
  TicketKeyLabel,
  useEntities,
  useMembers,
  useSdk,
} from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Badge } from "@kibo/sdk/ui/badge";
import { Button } from "@kibo/sdk/ui/button";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { buildTree, mineOnly, type TicketNode } from "./build-tree";
import { fr } from "./fr";

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_7rem_5rem_2rem] items-center gap-3 px-2 @3xl:grid-cols-[minmax(0,1fr)_7.5rem_10rem_5rem_2rem]";
const ASSIGNEE_CELL = "hidden min-w-0 @3xl:flex";

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

export function TicketsTree() {
  const sdk = useSdk();
  const { data: all, loading } = useEntities("ticket");
  const tickets = filterBySource(all, readSource(sdk.config));
  const mine = sdk.config.filter === "mine";
  const visible = mine ? mineOnly(tickets, sdk.viewer) : tickets;
  const { data: statuses } = useEntities("status");
  const { data: runs } = useEntities("run");
  const members = useMembers();
  const runOf = new Map(runs.map((r) => [r.ticketId, r]));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const label = (id: string) => statuses.find((s: Status) => s.id === id)?.label ?? id;
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const row = (n: TicketNode) => {
    const t = n.ticket;
    const open = !collapsed.has(t.id);
    return (
      <li key={t.id}>
        <div className={cn(COLUMNS, "group h-8 rounded-md text-sm hover:bg-muted/50")}>
          <div
            className="flex min-w-0 items-center gap-2 overflow-hidden"
            style={{ paddingLeft: n.depth * 20 }}
          >
            {n.children.length > 0 ? (
              <button
                type="button"
                className="text-muted-foreground"
                aria-label={open ? fr.collapse(t.keyLabel) : fr.expand(t.keyLabel)}
                onClick={() => toggle(t.id)}
              >
                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <TicketKeyLabel ticket={t} className="shrink-0 font-mono text-2xs text-muted-foreground" />
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
            <span className="truncate">{label(t.statusId)}</span>
          </span>
          <AssigneeCell assignee={t.assignee} run={runOf.get(t.id) ?? null} members={members} />
          <span className="font-mono text-2xs text-muted-foreground">
            {t.progress.total > 0 ? `${t.progress.done}/${t.progress.total}` : null}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={fr.newSubTicket(t.keyLabel)}
            onClick={() => sdk.openNewTicket({ parentId: t.id })}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {open && n.children.length > 0 && <ul>{n.children.map(row)}</ul>}
      </li>
    );
  };

  return (
    <section aria-label={fr.title} className="flex h-full flex-col">
      <header className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">
          {mine ? fr.mineCount(visible.length, tickets.length) : fr.title}
        </span>
        <Button size="sm" variant="outline" onClick={() => sdk.openNewTicket({})}>
          <Plus className="size-3.5" /> {fr.newTicket}
        </Button>
      </header>
      {loading ? null : visible.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{fr.empty}</p>
      ) : (
        <div className="@container min-h-0 flex-1 overflow-auto px-1 py-2">
          <div className={cn(COLUMNS, "h-8 text-2xs whitespace-nowrap text-muted-foreground")}>
            <span className="pl-6">{fr.columns.ticket}</span>
            <span>{fr.columns.status}</span>
            <span className={ASSIGNEE_CELL}>{fr.columns.assignee}</span>
            <span>{fr.columns.progress}</span>
            <span />
          </div>
          <ul>{buildTree(visible).map(row)}</ul>
        </div>
      )}
    </section>
  );
}
