import {
  type AgentsState,
  type DeliveryStep,
  isTerminal,
  KiboError,
  type RunDeliveryStep,
} from "@kibo/schema";

export type TicketStep = (projectId: string, ticketId: string) => DeliveryStep | null;

function stepOf(ticketStep: TicketStep, projectId: string, ticketId: string): DeliveryStep | null {
  try {
    return ticketStep(projectId, ticketId);
  } catch (e) {
    if (e instanceof KiboError && e.code === "NOT_FOUND") return null;
    throw e;
  }
}

export function deliveryStepsOf(state: Pick<AgentsState, "runs">, ticketStep: TicketStep): RunDeliveryStep[] {
  return state.runs.flatMap((run) => {
    if (isTerminal(run.state) || run.projectId === null || run.ticketId === null) return [];
    const delivery = stepOf(ticketStep, run.projectId, run.ticketId);
    return delivery ? [{ runId: run.id, step: delivery.step, note: delivery.note }] : [];
  });
}

export function withDeliverySteps<P extends { state(): AgentsState }>(port: P, ticketStep: TicketStep): P {
  return {
    ...port,
    state() {
      const state = port.state();
      return { ...state, delivery: deliveryStepsOf(state, ticketStep) };
    },
  };
}

export function withLocksDir<P extends { state(): AgentsState }>(port: P, locksDir: string): P {
  return { ...port, state: () => ({ ...port.state(), locksDir }) };
}
