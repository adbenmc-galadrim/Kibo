import {
  type Agent,
  type DeliverResult,
  type DeliveryKind,
  deliveryAgentOf,
  deliveryBrief,
  deliveryOrder,
  deliveryTicketsOf,
  FINAL_STATUSES,
  isTerminal,
  KiboError,
  type Link,
  type ProjectDelivery,
  type Question,
  type RunView,
  type TicketView,
  updateDeliveryBrief,
} from "@kibo/schema";
import { assertTicketExecution } from "../agents/execution-removed";
import type { Orchestrator } from "../runs/orchestrator-types";

export const NO_DELIVERY_AGENT = "aucun agent de livraison : choisis-le dans Modifier le projet";

export type DeliveryProject = {
  delivery: ProjectDelivery | null;
  tickets: readonly Pick<TicketView, "id" | "key" | "title" | "parentId" | "statusId" | "startable">[];
  links: readonly Pick<Link, "from" | "to" | "type">[];
  questions: readonly Pick<Question, "ticketId" | "blocking" | "answer" | "archivedAt">[];
};

export type DeliverDeps = {
  project(projectId: string): DeliveryProject;
  agents(projectId: string): readonly Pick<Agent, "ref" | "scope" | "name" | "settings">[];
  orchestrator: {
    state(): { runs: readonly Pick<RunView, "ticketId" | "state">[] };
    assign: Orchestrator["assign"];
    ticketExecution: Orchestrator["ticketExecution"];
  };
};

export type DeliverInput = { projectId: string; ticketId: string; mode?: DeliveryKind };

function busyTickets(runs: readonly Pick<RunView, "ticketId" | "state">[]): Set<string> {
  const busy = new Set<string>();
  for (const run of runs) if (run.ticketId !== null && !isTerminal(run.state)) busy.add(run.ticketId);
  return busy;
}

export function deliver(deps: DeliverDeps, input: DeliverInput): DeliverResult {
  assertTicketExecution(deps.orchestrator.ticketExecution(), "deliver");
  const project = deps.project(input.projectId);
  const ticket = project.tickets.find((t) => t.id === input.ticketId);
  if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${input.ticketId} not found`);
  if (ticket.key === null) throw new KiboError("INVALID_INPUT", "ticket has no key yet");
  const update = input.mode === "update";
  if (!update && FINAL_STATUSES.includes(ticket.statusId))
    throw new KiboError("INVALID_TRANSITION", `ticket ${ticket.key} is already done`);
  const agent = deliveryAgentOf(deps.agents(input.projectId), project.delivery);
  if (agent === null) throw new KiboError("AGENT_NOT_FOUND", NO_DELIVERY_AGENT);
  const parent = project.tickets.some((t) => t.parentId === ticket.id);
  if (update && parent)
    throw new KiboError("TICKET_HAS_CHILDREN", `ticket ${ticket.key} has sub-tickets: touch up one of them`);
  if (parent) {
    const items = deliveryOrder({
      tickets: deliveryTicketsOf(project),
      links: project.links,
      busy: busyTickets(deps.orchestrator.state().runs),
      parentId: ticket.id,
    });
    return { kind: "parent", items };
  }
  return deps.orchestrator.assign({
    projectId: input.projectId,
    ticketId: ticket.id,
    profileId: agent,
    brief: update ? updateDeliveryBrief(ticket.key) : deliveryBrief(ticket.key),
    fresh: false,
  });
}
