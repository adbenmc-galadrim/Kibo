import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { KiboError, type ProjectCommand, type Status, type StatusId, type TicketView } from "@kibo/schema";
import { filterBySource, readSource, useEntities, useMembers, useReadOnly, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { ReasonDialog } from "@kibo/sdk/ui/reason-dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { buildTree, mineOnly, type TicketNode } from "./build-tree";
import { EMPTY_QUERY, filterTree, isActive } from "./filter-tickets";
import { fr } from "./fr";
import { ASSIGNEE_CELL, COLUMNS, TicketRow } from "./TicketRow";
import { TicketsEmpty, TicketsNoMatch, TicketsSkeleton } from "./TicketsEmpty";
import { TicketsToolbar } from "./TicketsToolbar";
import { descendantCount, ticketMenuEntries } from "./ticket-menu";
import { dropPlan, parseZoneId } from "./tree-drop";

export function TicketsTree() {
  const sdk = useSdk();
  const readOnly = useReadOnly();
  const { data: all, loading } = useEntities("ticket");
  const tickets = filterBySource(all, readSource(sdk.config));
  const mine = sdk.config.filter === "mine";
  const visible = mine ? mineOnly(tickets, sdk.viewer) : tickets;
  const { data: statuses } = useEntities("status");
  const { data: runs } = useEntities("run");
  const members = useMembers();
  const runOf = new Map(runs.map((r) => [r.ticketId, r]));
  const [query, setQuery] = useState(EMPTY_QUERY);
  const filtering = isActive(query);
  const filtered = filtering ? filterTree(visible, query, sdk.viewer) : null;
  const shown = filtered?.visible ?? null;
  const canDrag = !readOnly && !filtering;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState<TicketView | null>(null);
  const [removing, setRemoving] = useState<TicketView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const label = (id: string) => statuses.find((s: Status) => s.id === id)?.label ?? id;
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const attempt = async (cmd: ProjectCommand, failure: string): Promise<boolean> => {
    try {
      await sdk.run(cmd);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof KiboError && e.code === "TREE_CYCLE" ? fr.cycle : failure);
      return false;
    }
  };
  const setStatus = (t: TicketView, statusId: StatusId) => {
    if (statusId === "blocked") {
      setError(null);
      setBlocking(t);
    } else void attempt({ method: "setStatus", ticketId: t.id, statusId }, fr.statusFailed(t.keyLabel));
  };
  const entriesFor = (t: TicketView) =>
    ticketMenuEntries({
      ticket: t,
      statuses,
      readOnly,
      texts: fr,
      actions: {
        open: () => sdk.openTicket(t.id),
        setStatus: (statusId) => setStatus(t, statusId),
        newSubTicket: () => sdk.openNewTicket({ parentId: t.id }),
        moveToRoot: () =>
          void attempt({ method: "moveTicket", ticketId: t.id, parentId: null }, fr.moveFailed(t.keyLabel)),
        remove: () => setRemoving(t),
      },
    });
  const onDragEnd = (e: DragEndEvent) => {
    if (!canDrag || e.over === null) return;
    const zone = parseZoneId(String(e.over.id));
    const plan = zone ? dropPlan(all, String(e.active.id), zone) : null;
    if (!plan) return;
    const key = all.find((t) => t.id === plan.ticketId)?.keyLabel ?? "";
    void attempt({ method: "moveTicket", ...plan }, fr.moveFailed(key));
  };

  const row = (n: TicketNode) => (
    <TicketRow
      key={n.ticket.id}
      node={n}
      open={!collapsed.has(n.ticket.id)}
      entries={entriesFor(n.ticket)}
      readOnly={readOnly}
      canDrag={canDrag}
      run={runOf.get(n.ticket.id) ?? null}
      members={members}
      statusLabel={label(n.ticket.statusId)}
      context={filtered?.context.has(n.ticket.id) ?? false}
      onToggle={() => toggle(n.ticket.id)}
    >
      {n.children.map(row)}
    </TicketRow>
  );

  return (
    <section aria-label={fr.title} className="flex h-full flex-col">
      <header className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">
          {mine ? fr.mineCount(visible.length, tickets.length) : fr.title}
        </span>
        {!readOnly && (loading || visible.length > 0) && (
          <Button size="sm" variant="outline" onClick={() => sdk.openNewTicket({})}>
            <Plus className="size-3.5" /> {fr.newTicket}
          </Button>
        )}
      </header>
      {error && !blocking && (
        <p role="alert" className="px-3 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <TicketsSkeleton />
      ) : visible.length === 0 ? (
        <TicketsEmpty readOnly={readOnly} onNewTicket={() => sdk.openNewTicket({})} />
      ) : (
        <>
          <TicketsToolbar query={query} statuses={statuses} onChange={setQuery} />
          {shown?.size === 0 ? (
            <TicketsNoMatch onClear={() => setQuery(EMPTY_QUERY)} />
          ) : (
            <div className="@container min-h-0 flex-1 overflow-auto px-1 py-2">
              <div className={cn(COLUMNS, "h-8 text-2xs whitespace-nowrap text-muted-foreground")}>
                <span className="pl-6">{fr.columns.ticket}</span>
                <span>{fr.columns.status}</span>
                <span className={ASSIGNEE_CELL}>{fr.columns.assignee}</span>
                <span>{fr.columns.progress}</span>
                <span />
              </div>
              <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
                <ul>{buildTree(shown ? visible.filter((t) => shown.has(t.id)) : visible).map(row)}</ul>
              </DndContext>
            </div>
          )}
        </>
      )}
      {blocking && (
        <ReasonDialog
          open
          title={fr.block.title(blocking.keyLabel)}
          description={fr.block.description}
          label={fr.block.reason}
          placeholder={fr.block.placeholder}
          confirmLabel={fr.block.confirm}
          cancelLabel={fr.block.cancel}
          error={error}
          onConfirm={(reason) =>
            void attempt(
              { method: "setStatus", ticketId: blocking.id, statusId: "blocked", reason },
              fr.statusFailed(blocking.keyLabel),
            ).then((ok) => ok && setBlocking(null))
          }
          onCancel={() => setBlocking(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.keyLabel)}
          description={fr.removeHelp(descendantCount(all, removing.id))}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={async () => {
            await sdk.run({ method: "deleteTicket", ticketId: removing.id });
          }}
        />
      )}
    </section>
  );
}
