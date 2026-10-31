import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  blockingQuestion,
  isBlocked,
  isGroup,
  questionLabel,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import {
  filterBySource,
  groupOfTicket,
  readSource,
  SelectionChip,
  useEntities,
  useSdk,
  useSelection,
  withoutAgentAssignee,
} from "@kibo/sdk";
import { useProject } from "@kibo/sdk/hooks/use-project";
import { useState } from "react";
import { announce } from "./announcements";
import { BlockDialog } from "./BlockDialog";
import { boardColumn, heldBy, isFolded } from "./board-column";
import { type ColumnOrder, orderColumn } from "./column-order";
import { DragPreview } from "./DragPreview";
import { type Drop, dropInColumn } from "./drop";
import { filterTickets, type KanbanFilter, projectLabels } from "./filter";
import { foldedFirst } from "./fold-collision";
import { fr } from "./fr";
import { KanbanCard } from "./KanbanCard";
import type { CardFacts } from "./KanbanCardContent";
import { KanbanCardPreview } from "./KanbanCardPreview";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanEmpty } from "./KanbanEmpty";
import { KanbanToolbar } from "./KanbanToolbar";
import { cardSteps } from "./keyboard-steps";
import { RemoveDialog } from "./RemoveDialog";
import { ToolbarAlerts } from "./ToolbarAlerts";
import { useBoardView } from "./use-board-view";
import { useCardMoves } from "./use-card-moves";
import { useColumnOrder } from "./use-column-order";
import { useHeldToast } from "./use-held-toast";
import { useLabelFilter } from "./use-label-filter";

type Blocking = { ticket: TicketView; drop: Drop | null };

export function Kanban() {
  const sdk = useSdk();
  const project = useProject();
  const { data: tickets, loading } = useEntities("ticket");
  const { data: statuses } = useEntities("status");
  const { data: questionList } = useEntities("question");
  const { data: sprints } = useEntities("sprint");
  const source = readSource(sdk.config);
  const { data: ciRuns, error: ciError } = useEntities("ci_run");
  const columnOrder = useColumnOrder(sdk);
  const labelFilter = useLabelFilter(sdk);
  const [selection, setSelection] = useSelection();
  const selected = selection ? new Set(selection.ids) : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: cardSteps }),
  );
  const scope: KanbanFilter =
    source === null && sdk.config.filter === "mine-and-agents" ? "mine-and-agents" : "all";
  const [blocking, setBlocking] = useState<Blocking | null>(null);
  const [removing, setRemoving] = useState<TicketView | null>(null);
  const held = useHeldToast();
  const [targetColumn, setTargetColumn] = useState<StatusId | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const scoped = filterBySource(tickets, source);
  const board = useBoardView({
    scoped,
    scope,
    viewer: sdk.viewer,
    label: labelFilter.label,
    sprints,
    ciRuns,
  });
  const shown = board.shown;
  const groupOf = groupOfTicket(tickets);
  const factsOf = (t: TicketView): CardFacts => ({
    ticket: withoutAgentAssignee(t),
    group: groupOf(t),
    blocked: isBlocked(t, questionList),
    blocking: blockingQuestion(t, questionList),
  });
  const draggedTicket = tickets.find((t) => t.id === dragged);
  const ciProblem = ciError && ciError.code !== "NOT_CONNECTED" ? ciError.detail : null;
  const ordered = [...statuses].sort((a, b) => a.order - b.order);
  const statusIds = new Set(ordered.map((s) => s.id));
  const columnOf = (t: TicketView): StatusId => boardColumn(t, isBlocked(t, questionList), statusIds);
  const holdOf = (t: TicketView, target: StatusId) => heldBy(t, columnOf(t), target, questionList);
  const forbidden = (target: StatusId) =>
    draggedTicket !== undefined && holdOf(draggedTicket, target) !== null;
  const refusalOf = (active: string | number, over: string | number): string | null => {
    const drop = dropInColumn({ active: { id: active }, over: { id: over } }, visible);
    const t = tickets.find((x) => x.id === drop?.ticketId);
    const question = drop && t ? holdOf(t, drop.statusId) : null;
    return t && question ? `${fr.heldBy(t.keyLabel, questionLabel(question))}.` : null;
  };
  const placed = tickets.map((t) => ({ id: t.id, statusId: t.statusId, column: columnOf(t) }));
  const columns = new Map(
    ordered.map((s) => [
      s.id,
      orderColumn(
        shown.filter((t) => columnOf(t) === s.id),
        columnOrder.order[s.id],
      ),
    ]),
  );
  const visible: ColumnOrder = Object.fromEntries(
    [...columns].map(([statusId, cards]) => [statusId, cards.map((t) => t.id)]),
  );

  const inScope = filterTickets(scoped, scope, sdk.viewer).filter((t) => !isGroup(t));
  const columnTotal = (id: StatusId) => inScope.filter((t) => columnOf(t) === id).length;
  const emptyColumns = ordered.map((s) => s.id).filter((id) => columnTotal(id) === 0);

  const keyOf = (id: string | number) => tickets.find((t) => t.id === id)?.keyLabel ?? statusLabel(id);
  const statusLabel = (id: string | number) => ordered.find((s) => s.id === id)?.label ?? "";

  const { error, setStatus, place } = useCardMoves(sdk, columnOrder, placed);
  const move = (t: TicketView, statusId: StatusId) => {
    if (statusId === t.statusId) return;
    if (statusId === "blocked") setBlocking({ ticket: t, drop: null });
    else void setStatus(t, statusId);
  };
  const onDragStart = (e: DragStartEvent) => setDragged(String(e.active.id));
  const endDrag = () => {
    setDragged(null);
    setTargetColumn(null);
  };
  const onDragOver = (e: DragOverEvent) => setTargetColumn(dropInColumn(e, visible)?.statusId ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    endDrag();
    const drop = dropInColumn(e, visible);
    const t = tickets.find((x) => x.id === drop?.ticketId);
    if (!drop || !t) return;
    const question = holdOf(t, drop.statusId);
    if (question !== null) {
      held.hold(t, question);
      return;
    }
    if (drop.statusId === "blocked" && columnOf(t) !== "blocked") setBlocking({ ticket: t, drop });
    else void place(t, drop);
  };

  return (
    <div className="flex h-full flex-col">
      <KanbanToolbar
        mine={scope === "all" ? null : fr.filter.mine}
        filters={board.filters}
        onFilters={board.choose}
        onClear={board.clear}
        total={board.total}
        counts={board.counts}
        sprintCode={board.sprintCode}
        label={labelFilter.label}
        labels={projectLabels(scoped)}
        onLabel={labelFilter.choose}
        onShowAll={() => {
          board.clear();
          if (labelFilter.label !== null) labelFilter.choose(null);
        }}
        shown={shown.length}
        hidden={board.hidden}
      >
        <SelectionChip selection={selection} onClear={() => setSelection(null)} />
        <ToolbarAlerts
          messages={[
            !blocking && error,
            columnOrder.failed && fr.orderUnavailable,
            labelFilter.failed && fr.labelFilter.failed,
            ciProblem && fr.ciUnavailable(ciProblem),
          ]}
        />
      </KanbanToolbar>
      {!loading && scoped.length === 0 && <KanbanEmpty onNew={() => sdk.openNewTicket({})} />}
      <DndContext
        sensors={sensors}
        collisionDetection={foldedFirst(emptyColumns)}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragCancel={endDrag}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: fr.drag.help },
          announcements: announce(keyOf, refusalOf),
        }}
      >
        <div className="scrollbar-none flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden p-3">
          {ordered.map((s) => (
            <KanbanColumn
              key={s.id}
              status={s}
              ids={visible[s.id] ?? []}
              targeted={targetColumn === s.id}
              forbidden={forbidden(s.id)}
              collapsed={isFolded(columnTotal(s.id), targetColumn === s.id, loading)}
              onAdd={() => sdk.openNewTicket({ statusId: s.id })}
            >
              {(columns.get(s.id) ?? []).map((t) => (
                <KanbanCard
                  key={t.id}
                  {...factsOf(t)}
                  selected={selected ? selected.has(t.id) : null}
                  statuses={ordered}
                  project={project}
                  onOpen={() => sdk.openTicket(t.id)}
                  onMove={(id) => move(t, id)}
                  onRemove={() => setRemoving(t)}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
        <DragPreview>
          {draggedTicket ? (
            <KanbanCardPreview
              {...factsOf(draggedTicket)}
              refused={targetColumn !== null && forbidden(targetColumn)}
            />
          ) : null}
        </DragPreview>
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
      {held.toast}
      {removing && (
        <RemoveDialog
          ticket={removing}
          childCount={tickets.filter((x) => x.parentId === removing.id).length}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
