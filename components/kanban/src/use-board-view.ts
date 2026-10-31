import { type CiRun, isGroup, type SprintView, type TicketView } from "@kibo/schema";
import { useEffect, useState } from "react";
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

type BoardView = {
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

function activeFilters(
  chosen: readonly KanbanFilterKey[],
  hasSprint: boolean,
  hasHeld: boolean,
): readonly KanbanFilterKey[] {
  if (!hasSprint && chosen.includes("sprint")) return NONE;
  if (!hasHeld && chosen.includes("held")) return chosen.filter((f) => f !== "held");
  return chosen;
}

export function useBoardView({ scoped, scope, viewer, label, sprints, ciRuns }: Input): BoardView {
  const [chosen, setChosen] = useState<readonly KanbanFilterKey[]>(NONE);
  const current = currentSprintOf(sprints);
  const facts = { currentSprintId: current?.id ?? null, ciRuns };
  const base = filterTickets(scoped, scope, viewer, label);
  const count = (f: KanbanFilterKey) => base.filter((t) => inFilters(t, [f], facts)).length;
  const counts = {
    sprint: count("sprint"),
    startable: count("startable"),
    toFix: count("toFix"),
    held: count("held"),
  };
  const filters = activeFilters(chosen, current !== null, counts.held > 0);
  useEffect(() => {
    if (filters.length < chosen.length) setChosen(filters);
  }, [filters, chosen]);
  const shown = base.filter((t) => inFilters(t, filters, facts));
  const inScope = filterTickets(scoped, scope, viewer).filter((t) => !isGroup(t)).length;
  return {
    filters,
    choose: (next) => setChosen(KANBAN_FILTERS.filter((f) => next.includes(f))),
    clear: () => setChosen(NONE),
    shown,
    total: base.length,
    counts,
    sprintCode: current?.code ?? null,
    hidden: inScope - shown.length,
  };
}
