import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { StatusId, TicketView } from "@kibo/schema";
import {
  filterBySource,
  readSource,
  remoteRuns,
  useEntities,
  usePresence,
  useSdk,
  useSharing,
} from "@kibo/sdk";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { useRef, useState } from "react";
import { announce } from "./announcements";
import { BlockDialog } from "./BlockDialog";
import { type ColumnOrder, orderColumn } from "./column-order";
import { commitDrop, type Drop, dropInColumn, nextOrder } from "./drop";
import { filterTickets, type KanbanFilter } from "./filter";
import { fr } from "./fr";
import { type CiChip, ciChipOf, KanbanCard } from "./KanbanCard";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanToolbar } from "./KanbanToolbar";
import { cardSteps } from "./keyboard-steps";
import { useColumnOrder } from "./use-column-order";

type Blocking = { ticket: TicketView; drop: Drop | null };

export function Kanban() {
  const sdk = useSdk();
  const { data: tickets } = useEntities("ticket");
  const { data: statuses } = useEntities("status");
  const { data: runs } = useEntities("run");
  const runOf = new Map(runs.map((r) => [r.ticketId, r]));
  const source = readSource(sdk.config);
  const { data: ciRuns, error: ciError } = useEntities("ci_run");
  const peers = usePresence();
  const sharing = useSharing();
  const readOnly = sharing.access !== "write";
  const columnOrder = useColumnOrder(sdk);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: cardSteps }),
  );
  const [filter, setFilter] = useState<KanbanFilter>(
    source !== null || sdk.config.filter === "all" ? "all" : "mine-and-agents",
  );
  const [blocking, setBlocking] = useState<Blocking | null>(null);
  const [removing, setRemoving] = useState<TicketView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetColumn, setTargetColumn] = useState<StatusId | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const scoped = filterBySource(tickets, source);
  const shown = filterTickets(scoped, filter, sdk.viewer);
  const ciOf = (t: TicketView): CiChip | undefined =>
    ciChipOf(ciRuns.filter((r) => t.key !== null && r.ticketKey === t.key));
  const ciProblem = ciError && ciError.code !== "NOT_CONNECTED" ? ciError.detail : null;
  const ordered = [...statuses].sort((a, b) => a.order - b.order);
  const columns = new Map(
    ordered.map((s) => [
      s.id,
      orderColumn(
        shown.filter((t) => t.statusId === s.id),
        columnOrder.order[s.id],
      ),
    ]),
  );
  const visible: ColumnOrder = Object.fromEntries(
    [...columns].map(([statusId, cards]) => [statusId, cards.map((t) => t.id)]),
  );

  const keyOf = (id: string | number) => tickets.find((t) => t.id === id)?.keyLabel ?? statusLabel(id);
  const statusLabel = (id: string | number) => ordered.find((s) => s.id === id)?.label ?? "";

  const setStatus = async (t: TicketView, statusId: StatusId, reason?: string): Promise<boolean> => {
    try {
      await sdk.run({ method: "setStatus", ticketId: t.id, statusId, reason });
      setError(null);
      return true;
    } catch {
      setError(fr.moveFailed(t.keyLabel));
      return false;
    }
  };
  const place = async (t: TicketView, drop: Drop, reason?: string): Promise<boolean> => {
    const done = await columnOrder.write(nextOrder(columnOrder.order, tickets, drop), () =>
      commitDrop(sdk, tickets, drop, reason),
    );
    setError(done ? null : fr.moveFailed(t.keyLabel));
    return done;
  };
  const move = (t: TicketView, statusId: StatusId) => {
    if (statusId === t.statusId) return;
    if (statusId === "blocked") setBlocking({ ticket: t, drop: null });
    else void setStatus(t, statusId);
  };
  const onDragMove = (e: DragMoveEvent) => {
    board.current?.style.setProperty("--drag-x", `${e.delta.x}px`);
    board.current?.style.setProperty("--drag-y", `${e.delta.y}px`);
  };
  const onDragOver = (e: DragOverEvent) => setTargetColumn(dropInColumn(e, visible)?.statusId ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setTargetColumn(null);
    if (readOnly) return;
    const drop = dropInColumn(e, visible);
    const t = tickets.find((x) => x.id === drop?.ticketId);
    if (!drop || !t) return;
    if (drop.statusId === "blocked" && t.statusId !== "blocked") setBlocking({ ticket: t, drop });
    else void place(t, drop);
  };

  return (
    <div className="flex h-full flex-col">
      <KanbanToolbar filter={filter} onFilter={setFilter} shown={shown.length} total={scoped.length}>
        {error && !blocking && (
          <p role="alert" className="truncate text-destructive">
            {error}
          </p>
        )}
        {columnOrder.failed && (
          <p role="alert" className="truncate text-destructive">
            {fr.orderUnavailable}
          </p>
        )}
        {ciProblem && (
          <p role="alert" className="truncate text-destructive">
            {fr.ciUnavailable(ciProblem)}
          </p>
        )}
      </KanbanToolbar>
      <DndContext
        sensors={readOnly ? [] : sensors}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragCancel={() => setTargetColumn(null)}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: fr.drag.help },
          announcements: announce(keyOf),
        }}
      >
        <div ref={board} className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-3">
          {ordered.map((s) => (
            <KanbanColumn
              key={s.id}
              status={s}
              ids={visible[s.id] ?? []}
              targeted={targetColumn === s.id}
              onAdd={readOnly ? undefined : () => sdk.openNewTicket({ statusId: s.id })}
            >
              {(columns.get(s.id) ?? []).map((t) => (
                <KanbanCard
                  key={t.id}
                  ticket={t}
                  run={runOf.get(t.id) ?? null}
                  ci={ciOf(t)}
                  statuses={ordered}
                  members={sharing.members}
                  remote={remoteRuns(peers, t.key)}
                  readOnly={readOnly}
                  onOpen={() => sdk.openTicket(t.id)}
                  onMove={(id) => move(t, id)}
                  onRemove={() => setRemoving(t)}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
      </DndContext>
      {blocking && (
        <BlockDialog
          ticketKey={blocking.ticket.keyLabel}
          error={error}
          onCancel={() => setBlocking(null)}
          onConfirm={async (reason) => {
            const { ticket, drop } = blocking;
            const done = drop
              ? await place(ticket, drop, reason)
              : await setStatus(ticket, "blocked", reason);
            if (done) setBlocking(null);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.keyLabel)}
          description={fr.removeHelp(tickets.filter((x) => x.parentId === removing.id).length)}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={async () => {
            await sdk.run({ method: "deleteTicket", ticketId: removing.id });
          }}
        />
      )}
    </div>
  );
}
