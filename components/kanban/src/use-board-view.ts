import { type CiRun, currentSprint, isGroup, type Sprint, type TicketView } from "@kibo/schema";
import { useState } from "react";
import { filterTickets, inMode, type KanbanFilter, type KanbanMode } from "./filter";
import { localToday } from "./sprint-filter";

type Input = {
  scoped: TicketView[];
  scope: KanbanFilter;
  viewer: string;
  label: string | null;
  sprints: readonly Sprint[];
  ciRuns: readonly CiRun[];
};

export type BoardView = {
  mode: KanbanMode;
  setMode: (mode: KanbanMode) => void;
  shown: TicketView[];
  counts: Record<KanbanMode, number>;
  sprintCode: string | null;
  hidden: number;
};

export function useBoardView({ scoped, scope, viewer, label, sprints, ciRuns }: Input): BoardView {
  const [mode, setMode] = useState<KanbanMode>("all");
  const today = localToday();
  const facts = { sprints, today, ciRuns };
  const base = filterTickets(scoped, scope, viewer, label);
  const count = (m: KanbanMode) => base.filter((t) => inMode(t, m, facts)).length;
  const counts = { all: count("all"), sprint: count("sprint"), toFix: count("toFix") };
  const shown = base.filter((t) => inMode(t, mode, facts));
  const inScope = filterTickets(scoped, scope, viewer).filter((t) => !isGroup(t)).length;
  return {
    mode,
    setMode,
    shown,
    counts,
    sprintCode: currentSprint(sprints, today)?.code ?? null,
    hidden: inScope - shown.length,
  };
}
