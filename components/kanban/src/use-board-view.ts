import { type CiRun, isGroup, type SprintView, type TicketView } from "@kibo/schema";
import { useState } from "react";
import { filterTickets, inFilters, KANBAN_FILTERS, type KanbanFilter, type KanbanFilterKey } from "./filter";
import { currentSprintOf } from "./sprint-filter";

type Input = {
  scoped: TicketView[];
  scope: KanbanFilter;
  viewer: string;
  label: string | null;
  sprints: readonly SprintView[];
  ciRuns: readonly CiRun[];
};

export type BoardView = {
  filters: readonly KanbanFilterKey[];
  choose: (filters: readonly KanbanFilterKey[]) => void;
  clear: () => void;
  shown: TicketView[];
  total: number;
  counts: Record<KanbanFilterKey, number>;
  sprintCode: string | null;
  hidden: number;
};

const NONE: readonly KanbanFilterKey[] = [];

export function useBoardView({ scoped, scope, viewer, label, sprints, ciRuns }: Input): BoardView {
  const [filters, setFilters] = useState<readonly KanbanFilterKey[]>(NONE);
  const current = currentSprintOf(sprints);
  if (current === null && filters.includes("sprint")) setFilters(NONE);
  const facts = { currentSprintId: current?.id ?? null, ciRuns };
  const base = filterTickets(scoped, scope, viewer, label);
  const count = (f: KanbanFilterKey) => base.filter((t) => inFilters(t, [f], facts)).length;
  const counts = {
    sprint: count("sprint"),
    startable: count("startable"),
    toFix: count("toFix"),
    held: count("held"),
  };
  if (counts.held === 0 && filters.includes("held")) setFilters(filters.filter((f) => f !== "held"));
  const shown = base.filter((t) => inFilters(t, filters, facts));
  const inScope = filterTickets(scoped, scope, viewer).filter((t) => !isGroup(t)).length;
  return {
    filters,
    choose: (next) => setFilters(KANBAN_FILTERS.filter((f) => next.includes(f))),
    clear: () => setFilters(NONE),
    shown,
    total: base.length,
    counts,
    sprintCode: current?.code ?? null,
    hidden: inScope - shown.length,
  };
}
