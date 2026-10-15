import {
  type AgentsState,
  deliveryStepLabel,
  type RunDeliveryStep,
  type RunProgressSummary,
} from "@kibo/schema";
import { fr } from "../i18n/fr";

export function barSummary(state: AgentsState, t: typeof fr.agents): string {
  const waiting = state.runs.filter((r) => r.state === "waiting_input").length;
  return t.summary(state.host.used, state.host.hostSlots, state.queue.length, waiting);
}

export function stepChip(
  summary: RunProgressSummary | undefined,
  delivery?: Pick<RunDeliveryStep, "step">,
): string | null {
  if (delivery) return deliveryStepLabel(delivery.step);
  const step = summary?.step;
  return step ? fr.agents.stepShort(step.index, step.total, step.title) : null;
}
