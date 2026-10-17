import { readProject } from "@kibo/core";
import { initRun } from "@kibo/core/run-machine";
import {
  type DeliverResult,
  type DeliveryAgent,
  type DeliveryKind,
  deliveryBrief,
  deliveryOrder,
  deliveryTicketsOf,
  KiboError,
  type RunDenials,
  type TicketRun,
  updateDeliveryBrief,
} from "@kibo/schema";
import { activityOf } from "./mock-runs";
import type { AllowAndResumeInput } from "./types";

export const MOCK_DELIVERY_AGENT = "global:full-delivery";
export const MOCK_DELIVERY_AGENT_INFO: DeliveryAgent = { ref: MOCK_DELIVERY_AGENT, name: "full-delivery" };

export type MockRunDelivery = {
  deliver(ticketId: string, mode?: DeliveryKind): DeliverResult;
  denials(runId: string): RunDenials | null;
  agent(): DeliveryAgent | null;
  allowAndResume(input: AllowAndResumeInput): null;
  delivered: string[];
  allowed: AllowAndResumeInput[];
};

export function createMockRunDelivery(deps: {
  today: string;
  doc: Parameters<typeof readProject>[0];
  runs(): TicketRun[];
  denials: Record<string, RunDenials>;
  agent: DeliveryAgent | null;
}): MockRunDelivery {
  const delivered: string[] = [];
  const allowed: AllowAndResumeInput[] = [];
  const deliver = (ticketId: string, mode?: DeliveryKind): DeliverResult => {
    delivered.push(ticketId);
    const activity = activityOf(deps.runs());
    const snapshot = readProject(deps.doc, deps.today, activity);
    const ticket = snapshot.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${ticketId} not found`);
    if (snapshot.tickets.some((t) => t.parentId === ticketId)) {
      const tickets = deliveryTicketsOf(snapshot);
      return {
        kind: "parent",
        items: deliveryOrder({
          tickets,
          links: snapshot.links,
          busy: activity.busyTickets,
          parentId: ticketId,
        }),
      };
    }
    const seq = delivered.length;
    const at = Date.now();
    return initRun(
      {
        id: `mock-delivery-${seq}`,
        kind: "ticket",
        seq,
        projectId: snapshot.meta.id,
        ticketId,
        ticketKey: ticket.keyLabel,
        ticketTitle: ticket.title,
        profileId: MOCK_DELIVERY_AGENT,
        profileName: "full-delivery",
        agentScope: "global",
        projectKey: snapshot.meta.key,
        sessionId: `mock-session-${seq}`,
        brief: (mode === "update" ? updateDeliveryBrief : deliveryBrief)(ticket.keyLabel),
        createdAt: at,
        resumedFrom: null,
      },
      seq,
      at,
    );
  };
  return {
    deliver,
    denials: (runId) => structuredClone(deps.denials[runId] ?? null),
    agent: () => structuredClone(deps.agent),
    allowAndResume: (input) => {
      allowed.push(structuredClone(input));
      return null;
    },
    delivered,
    allowed,
  };
}
