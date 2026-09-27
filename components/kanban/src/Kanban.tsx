import { DndContext, type DragEndEvent, useDroppable } from "@dnd-kit/core";
import type { Status, StatusId, TicketView } from "@kibo/schema";
import {
  filterBySource,
  readSource,
  remoteRuns,
  StatusDot,
  useEntities,
  usePresence,
  useSdk,
  useSharing,
} from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { BlockDialog } from "./BlockDialog";
import { filterTickets, type KanbanFilter } from "./filter";
import { fr } from "./fr";
import { type CiChip, ciChipOf, KanbanCard } from "./KanbanCard";

type ColumnProps = { status: Status; count: number; children: ReactNode; onAdd?: () => void };

function Column({ status, count, children, onAdd }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={status.label}
      className={cn(
        "flex min-w-[180px] flex-1 flex-col gap-2 rounded-lg bg-muted/40 p-2",
        isOver && "ring-2 ring-ring",
      )}
    >
      <header className="flex h-7 items-center gap-2 px-1 text-xs">
        <StatusDot statusId={status.id} />
        <span className="font-medium">{status.label}</span>
        <span className="flex-1" />
        <span className="font-mono text-2xs text-muted-foreground">{count}</span>
        {onAdd ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label={fr.newTicketIn(status.label)}
            onClick={onAdd}
          >
            <Plus className="size-3.5" />
          </Button>
        ) : (
          <span className="size-6" />
        )}
      </header>
      {children}
    </section>
  );
}

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
  const [filter, setFilter] = useState<KanbanFilter>(
    source !== null || sdk.config.filter === "all" ? "all" : "mine-and-agents",
  );
  const [blocking, setBlocking] = useState<TicketView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scoped = filterBySource(tickets, source);
  const shown = filterTickets(scoped, filter, sdk.viewer);
  const ciOf = (t: TicketView): CiChip | undefined =>
    ciChipOf(ciRuns.filter((r) => t.key !== null && r.ticketKey === t.key));
  const ciProblem = ciError && ciError.code !== "NOT_CONNECTED" ? ciError.detail : null;
  const ordered = [...statuses].sort((a, b) => a.order - b.order);

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
  const move = (t: TicketView, statusId: StatusId) => {
    if (statusId === t.statusId) return;
    if (statusId === "blocked") setBlocking(t);
    else void setStatus(t, statusId);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (readOnly) return;
    const t = tickets.find((x) => x.id === e.active.id);
    const target = ordered.find((s) => s.id === e.over?.id);
    if (t && target) move(t, target.id);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 items-center gap-2 border-b px-3 text-sm">
        <Button
          size="sm"
          variant={filter === "mine-and-agents" ? "secondary" : "ghost"}
          onClick={() => setFilter("mine-and-agents")}
        >
          {fr.filter.mineAndAgents}
        </Button>
        <Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")}>
          {fr.filter.all}
        </Button>
        {error && !blocking && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {ciProblem && (
          <p role="alert" className="truncate text-destructive">
            {fr.ciUnavailable(ciProblem)}
          </p>
        )}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {fr.counter(shown.length, scoped.length)}
        </span>
      </header>
      <DndContext onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto p-3">
          {ordered.map((s) => {
            const cards = shown.filter((t) => t.statusId === s.id);
            return (
              <Column
                key={s.id}
                status={s}
                count={cards.length}
                onAdd={
                  readOnly || s.id === "blocked" ? undefined : () => sdk.openNewTicket({ statusId: s.id })
                }
              >
                {cards.map((t) => (
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
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
      {blocking && (
        <BlockDialog
          ticketKey={blocking.keyLabel}
          error={error}
          onCancel={() => setBlocking(null)}
          onConfirm={async (reason) => {
            if (await setStatus(blocking, "blocked", reason)) setBlocking(null);
          }}
        />
      )}
    </div>
  );
}
