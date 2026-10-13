import { type AgentsState, openOverlapTotal, type RunProgressSummary } from "@kibo/schema";
import { fr } from "../i18n/fr";

export function barSummary(state: AgentsState, t: typeof fr.agents): string {
  const waiting = state.runs.filter((r) => r.state === "waiting_input").length;
  const overlaps = openOverlapTotal(state);
  const summary = t.summary(state.host.used, state.host.hostSlots, state.queue.length, waiting);
  return overlaps > 0 ? `${summary} · ${t.overlapCount(overlaps)}` : summary;
}

export function stepChip(summary: RunProgressSummary | undefined): string | null {
  const step = summary?.step;
  return step ? fr.agents.stepShort(step.index, step.total, step.title) : null;
}
