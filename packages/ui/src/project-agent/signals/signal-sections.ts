import { type Batch, isOpenSignal, SIGNALS_CLOSED_SHOWN, type Signal, type SignalsView } from "@kibo/schema";
import { frSignals } from "../../i18n/fr-signals";

export type WakeupState = "none" | { kind: "due"; at: number } | { kind: "last"; at: number };
export type BoxSections = { open: Signal[]; closed: Signal[]; wakeup: WakeupState };

const decidedAt = (s: Signal): number => s.decidedAt ?? s.createdAt;

export function boxSections(view: SignalsView): BoxSections {
  const open = view.signals.filter(isOpenSignal).sort((a, b) => b.createdAt - a.createdAt);
  const closed = view.signals
    .filter((s) => !isOpenSignal(s))
    .sort((a, b) => decidedAt(b) - decidedAt(a))
    .slice(0, SIGNALS_CLOSED_SHOWN);
  const { dueAt, lastAt } = view.wakeup;
  const wakeup: WakeupState =
    dueAt !== null ? { kind: "due", at: dueAt } : lastAt !== null ? { kind: "last", at: lastAt } : "none";
  return { open, closed, wakeup };
}

const t = frSignals.box;

export function signalOutcome(signal: Signal, batches: readonly Batch[]): string | null {
  if (isOpenSignal(signal)) return null;
  const batch = batches.find((b) => b.id === signal.batchId);
  if (signal.status === "ignored") return batch ? t.dismissedIn(batch.seq) : t.ignored;
  if (!batch) return t.handled;
  const created = batch.results.find((r) => r.actionId === signal.actionId)?.created;
  return created ? `${t.handledIn(batch.seq)} · ${created.key}` : t.handledIn(batch.seq);
}
