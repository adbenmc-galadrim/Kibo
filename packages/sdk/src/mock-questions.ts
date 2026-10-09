import { executeProjectCommand, listQuestions } from "@kibo/core";
import { type DeliveryResult, KiboError, undeliveredAnswers } from "@kibo/schema";

export const MOCK_DELIVERY_RUN = "mock";

export type MockDeliveryDeps = {
  doc: Parameters<typeof listQuestions>[0];
  refused: boolean;
  deliveries: string[];
  changed(): void;
};

export function createMockDelivery(deps: MockDeliveryDeps): (ticketId: string) => DeliveryResult {
  return (ticketId) => {
    deps.deliveries.push(ticketId);
    if (deps.refused) {
      throw new KiboError("INVALID_TRANSITION", `ticket ${ticketId} has no session to resume`);
    }
    const pending = undeliveredAnswers(listQuestions(deps.doc), ticketId);
    if (pending.length === 0) return { sent: 0, runId: null };
    executeProjectCommand(deps.doc, {
      method: "markAnswersDelivered",
      ticketId,
      questionIds: pending.map((q) => q.id),
      runId: MOCK_DELIVERY_RUN,
      at: Date.now(),
    });
    deps.changed();
    return { sent: pending.length, runId: MOCK_DELIVERY_RUN };
  };
}
