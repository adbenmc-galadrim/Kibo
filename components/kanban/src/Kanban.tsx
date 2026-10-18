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
  type Question,
  questionLabel,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import {
  agentTracesShown,
  filterBySource,
  groupOfTicket,
  menuDeliverEntry,
  readSource,
  remoteRuns,
  SelectionChip,
  useDeliverFlow,
  useDeliveryAgentKnown,
  useEntities,
  usePresence,
  useQuestionsChipData,
  useSdk,
  useSelection,
  useSharing,
  withoutAgentAssignee,
} from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { useCallback, useState } from "react";
import { announce } from "./announcements";
import { BlockDialog } from "./BlockDialog";
import { boardColumn, heldBy } from "./board-column";
import { type ColumnOrder, orderColumn } from "./column-order";
import { DragPreview } from "./DragPreview";
import { type Drop, dropInColumn } from "./drop";
import { type KanbanFilter, projectLabels } from "./filter";
import { fr } from "./fr";
import { HeldToast } from "./HeldToast";
import { KanbanCard } from "./KanbanCard";
import type { CardFacts } from "./KanbanCardContent";
import { KanbanCardPreview } from "./KanbanCardPreview";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanEmpty } from "./KanbanEmpty";
import { KanbanToolbar } from "./KanbanToolbar";
import { cardSteps } from "./keyboard-steps";
import { RemoveDialog } from "./RemoveDialog";
import { ToolbarAlerts } from "./ToolbarAlerts";
import { ticketCiRuns } from "./ticket-pr";
import { useBoardView } from "./use-board-view";
import { useCardMoves } from "./use-card-moves";
import { useColumnOrder } from "./use-column-order";
import { useLabelFilter } from "./use-label-filter";

type Blocking = { ticket: TicketView; drop: Drop | null };
type Held = { ticket: TicketView; question: Question };

export function Kanban() {
  const sdk = useSdk();
  const { data: tickets, loading } = useEntities("ticket");
  const { data: statuses } = useEntities("status");
  const { data: runs } = useEntities("run");
  const runOf = new Map(runs.map((r) => [r.ticketId, r]));
  const questions = useQuestionsChipData(runs);
  const { data: questionList } = useEntities("question");
  const { data: sprints } = useEntities("sprint");
  const source = readSource(sdk.config);
  const { data: ciRuns, error: ciError } = useEntities("ci_run");
  const peers = usePresence();
  const sharing = useSharing();
  const readOnly = sharing.access !== "write";
  const delivery = useDeliverFlow();
  const agentKnown = useDeliveryAgentKnown();
  const { agentExecution } = useComponentSettings();
  const columnOrder = useColumnOrder(sdk);
  const labelFilter = useLabelFilter(sdk, !readOnly);
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
  const [held, setHeld] = useState<Held | null>(null);
  const closeHeld = useCallback(() => setHeld(null), []);
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
  const agentTraces = agentTracesShown(agentExecution);
  const factsOf = (t: TicketView): CardFacts => ({
    ticket: agentTraces ? t : withoutAgentAssignee(t),
    group: groupOf(t),
    run: agentTraces ? (runOf.get(t.id) ?? null) : null,
    ciRuns: ticketCiRuns(t, ciRuns),
    blocked: isBlocked(t, questionList),
    blocking: blockingQuestion(t, questionList),
    members: sharing.members,
    remote: agentTraces ? remoteRuns(peers, t.key) : [],
    questions,
  });
  const deliverOf = (t: TicketView) =>
    menuDeliverEntry({
      ticket: t,
      editable: !readOnly,
      agentKnown,
      parent: tickets.some((x) => x.parentId === t.id),
      run: runOf.get(t.id) ?? null,
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
    if (readOnly) return;
    const drop = dropInColumn(e, visible);
    const t = tickets.find((x) => x.id === drop?.ticketId);
    if (!drop || !t) return;
    const question = holdOf(t, drop.statusId);
    if (question !== null) {
      setHeld({ ticket: t, question });
      return;
    }
    if (drop.statusId === "blocked" && columnOf(t) !== "blocked") setBlocking({ ticket: t, drop });
    else void place(t, drop);
  };

  return (
    <div className="flex h-full flex-col">
      <KanbanToolbar
        mine={scope === "all" ? null : agentTraces ? fr.filter.mineAndAgents : fr.filter.mine}
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
            delivery.error,
            columnOrder.failed && fr.orderUnavailable,
            labelFilter.failed && fr.labelFilter.failed,
            ciProblem && fr.ciUnavailable(ciProblem),
          ]}
        />
      </KanbanToolbar>
      {!loading && scoped.length === 0 && (
        <KanbanEmpty onNew={readOnly ? undefined : () => sdk.openNewTicket({})} />
      )}
      <DndContext
        sensors={sensors}
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
              onAdd={readOnly ? undefined : () => sdk.openNewTicket({ statusId: s.id })}
            >
              {(columns.get(s.id) ?? []).map((t) => (
                <KanbanCard
                  key={t.id}
                  {...factsOf(t)}
                  selected={selected ? selected.has(t.id) : null}
                  statuses={ordered}
                  readOnly={readOnly}
                  deliver={deliverOf(t)}
                  execution={agentExecution}
                  onDeliver={(mode) => delivery.deliver(t, mode)}
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
              readOnly={readOnly}
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
      {held && <HeldToast ticketKey={held.ticket.keyLabel} question={held.question} onClose={closeHeld} />}
      {delivery.dialog}
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
