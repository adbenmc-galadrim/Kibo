import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ProjectCommand, Status, TicketView } from "@kibo/schema";
import {
  filterBySource,
  readSource,
  SelectionChip,
  useEntities,
  useMembers,
  useQuestionsChipData,
  useReadOnly,
  useSdk,
  useSelection,
} from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { buildSections, featureOf, withAncestors } from "./build-tree";
import { CELL, ROW } from "./columns";
import {
  ALL_SPRINTS,
  chosenSprint,
  cleared,
  EMPTY_QUERY,
  isActive,
  NO_SPRINT,
  sortTickets,
} from "./filter-tickets";
import { fr } from "./fr";
import { TicketRow } from "./TicketRow";
import { TicketSection } from "./TicketSection";
import { TicketsEmpty, TicketsNoMatch, TicketsSkeleton } from "./TicketsEmpty";
import { TicketsToolbar } from "./TicketsToolbar";
import { dropPlan, parseZoneId } from "./tree-drop";
import { useSearchKeys } from "./use-search-keys";
import { useTicketActions } from "./use-ticket-actions";

const TABLE =
  "relative overflow-hidden rounded-[8px] bg-(--tracking-card) after:pointer-events-none after:absolute after:inset-0 after:rounded-[8px] after:border after:border-(--tracking-border)";
const PRIMARY =
  "h-[25px] gap-[6px] rounded-[6px] bg-zinc-900 px-[10px] text-[12px] leading-[1.2] font-medium text-zinc-50 hover:bg-zinc-900/90 has-[>svg]:px-[10px] dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90";

const RECENT_DONE = 4;

export function TicketsTree() {
  const sdk = useSdk();
  const readOnly = useReadOnly();
  const { data: all, loading } = useEntities("ticket");
  const { data: sprints } = useEntities("sprint");
  const { data: statuses } = useEntities("status");
  const { data: runs } = useEntities("run");
  const { data: ciRuns } = useEntities("ci_run");
  const { agentExecution } = useComponentSettings();
  const tickets = filterBySource(all, readSource(sdk.config));
  const mine = sdk.config.filter === "mine";
  const [saved, setSaved] = useState<unknown>(sdk.config.sprint);
  const sprint = chosenSprint(saved, sprints);
  const [query, setQuery] = useState(EMPTY_QUERY);
  const [doneOpen, setDoneOpen] = useState(sdk.config.doneOpen !== false);
  const [allDone, setAllDone] = useState(false);
  const [searching, setSearching] = useState(false);
  const openSearch = useCallback(() => setSearching(true), []);
  const onKeyDown = useSearchKeys(sdk.surface === "view", openSearch);
  const [looseOpen, setLooseOpen] = useState(false);
  const [selection, setSelection] = useSelection();
  const actions = useTicketActions(all, runs, statuses);
  const questions = useQuestionsChipData(runs);
  const members = useMembers();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const sections = buildSections({
    tickets,
    sprint,
    query,
    mine: mine ? sdk.viewer : null,
    viewer: sdk.viewer,
  });
  const recent = new Set(
    sortTickets(sections.done, "recent")
      .slice(0, RECENT_DONE)
      .map((t) => t.id),
  );
  const doneShown = allDone ? sections.done : sections.done.filter((t) => recent.has(t.id));
  const rootOf = featureOf(all);
  const runOf = new Map(runs.map((r) => [r.ticketId, r]));
  const selected = new Set(selection?.ids ?? []);
  const sharp = selection ? withAncestors(all, selection.ids) : null;
  const canDrag = !readOnly && !isActive(query);
  const now = Date.now();
  const label = (id: string) => statuses.find((s: Status) => s.id === id)?.label ?? id;
  const sprintLabel = sprints.find((s) => s.id === sprint)?.code ?? null;
  const scope =
    sprint === ALL_SPRINTS
      ? fr.scope.all
      : sprint === NO_SPRINT
        ? fr.scope.none
        : fr.scope.sprint(sprintLabel ?? "");

  const toggleDone = (open: boolean) => {
    setDoneOpen(open);
    void sdk.setConfig({ doneOpen: open });
  };
  const chooseSprint = (value: string) => {
    setSaved(value);
    void sdk.setConfig({ sprint: value });
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!canDrag || e.over === null) return;
    const zone = parseZoneId(String(e.over.id));
    const plan = zone ? dropPlan(all, String(e.active.id), zone) : null;
    if (!plan) return;
    const cmd: ProjectCommand = { method: "moveTicket", ...plan };
    void actions.attempt(cmd, fr.moveFailed(all.find((t) => t.id === plan.ticketId)?.keyLabel ?? ""));
  };
  const row = (t: TicketView) => (
    <TicketRow
      key={t.id}
      ticket={t}
      feature={rootOf(t)}
      ciRuns={t.key === null ? [] : ciRuns.filter((r) => r.ticketKey === t.key)}
      run={runOf.get(t.id) ?? null}
      execution={agentExecution}
      members={members}
      statusLabel={label(t.statusId)}
      entries={actions.entriesFor(t)}
      readOnly={readOnly}
      canDrag={canDrag}
      questions={questions}
      selected={sharp ? selected.has(t.id) : null}
      dimmed={sharp !== null && !sharp.has(t.id)}
      now={now}
    />
  );
  const empty = sections.open.length + sections.done.length + sections.loose.length === 0;

  return (
    <section
      aria-label={fr.title}
      onKeyDown={onKeyDown}
      className="@container flex h-full flex-col gap-3 overflow-auto px-6 py-[18px]"
    >
      <header className="flex items-end gap-[10px]">
        {sdk.surface === "view" && (
          <h1 className="text-[22px] leading-[27px] font-semibold text-(--tracking-fg)">
            {mine ? fr.mine : fr.title}
          </h1>
        )}
        <span className="min-w-0 truncate text-[12.5px] leading-[1.2] text-(--tracking-dim)">
          {fr.summary(scope, sections.tickets, sections.features.length)}
        </span>
        <SelectionChip selection={selection} onClear={() => setSelection(null)} />
        <span className="flex-1" />
        {!readOnly && (
          <Button size="sm" className={PRIMARY} onClick={() => sdk.openNewTicket({})}>
            <Plus absoluteStrokeWidth size={13} aria-hidden className="size-[13px]" />
            {fr.newTicket}
          </Button>
        )}
      </header>
      {actions.error && (
        <p role="alert" className="text-xs text-destructive">
          {actions.error}
        </p>
      )}
      {loading ? (
        <TicketsSkeleton />
      ) : tickets.length === 0 ? (
        <TicketsEmpty readOnly={readOnly} onNewTicket={() => sdk.openNewTicket({})} />
      ) : (
        <>
          <TicketsToolbar
            sprints={sprints}
            sprint={sprint}
            onSprint={chooseSprint}
            query={query}
            features={sections.features}
            statuses={statuses}
            tickets={tickets}
            searching={searching}
            onSearchClose={() => setSearching(false)}
            onChange={setQuery}
          />
          {empty ? (
            <TicketsNoMatch onClear={isActive(query) ? () => setQuery(cleared(query)) : null} />
          ) : (
            <div className={TABLE}>
              <div
                className={cn(
                  ROW,
                  "h-8 bg-(--tracking-panel) text-[11.5px] leading-[1.2] font-medium whitespace-nowrap text-(--tracking-dim)",
                )}
              >
                <span className={CELL.key}>{fr.columns.key}</span>
                <span className={CELL.title}>{fr.columns.title}</span>
                <span className={CELL.feature}>{fr.columns.feature}</span>
                <span className={CELL.status}>{fr.columns.status}</span>
                <span className={CELL.git}>{fr.columns.git}</span>
                <span className={CELL.delivery}>{fr.columns.delivery}</span>
                <span className={CELL.updated}>{fr.columns.updated}</span>
              </div>
              <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
                <ul>
                  {sections.open.map(row)}
                  {sections.done.length > 0 && (
                    <TicketSection
                      label={fr.done(sprintLabel)}
                      count={sections.done.length}
                      open={doneOpen}
                      onOpenChange={toggleDone}
                      more={
                        sections.done.length > RECENT_DONE
                          ? { all: allDone, recent: RECENT_DONE, onToggle: () => setAllDone((a) => !a) }
                          : null
                      }
                      done
                    >
                      {doneShown.map(row)}
                    </TicketSection>
                  )}
                  {sections.loose.length > 0 && (
                    <TicketSection
                      label={fr.loose}
                      count={sections.loose.length}
                      open={looseOpen}
                      onOpenChange={setLooseOpen}
                    >
                      {sections.loose.map(row)}
                    </TicketSection>
                  )}
                </ul>
              </DndContext>
            </div>
          )}
          <p className="flex items-center gap-2 text-[11.5px] leading-[1.2] text-(--tracking-dim)">
            <RefreshCw absoluteStrokeWidth size={13} aria-hidden className="size-[13px] shrink-0" />
            {fr.footer}
          </p>
        </>
      )}
      {actions.dialogs}
    </section>
  );
}
