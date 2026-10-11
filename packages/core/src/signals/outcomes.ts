import type { ActionResult, Batch, ProposedAction, SignalRef } from "@kibo/schema";

export type SignalOutcome = { ref: SignalRef; batchId: string; actionId: number };
export type SignalOutcomes = { handled: SignalOutcome[]; ignored: SignalOutcome[] };

const citedBy = (action: ProposedAction): SignalRef[] =>
  action.type === "dismissSignal" ? [action.signal] : (action.signals ?? []);

export function signalOutcomes(
  batch: Pick<Batch, "id" | "actions">,
  results: readonly ActionResult[],
): SignalOutcomes {
  const applied = new Set(results.filter((r) => r.outcome === "applied").map((r) => r.actionId));
  const settled = new Set<SignalRef>();
  const outcomes: SignalOutcomes = { handled: [], ignored: [] };
  for (const action of batch.actions) {
    if (!applied.has(action.id)) continue;
    const into = action.type === "dismissSignal" ? outcomes.ignored : outcomes.handled;
    for (const ref of citedBy(action)) {
      if (settled.has(ref)) continue;
      settled.add(ref);
      into.push({ ref, batchId: batch.id, actionId: action.id });
    }
  }
  return outcomes;
}
