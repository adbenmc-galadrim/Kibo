import {
  type Agent,
  type DeliverResult,
  type DeliveryKind,
  KiboError,
  type Link,
  type ProjectDelivery,
  type Question,
  type RunView,
  type TicketView,
} from "@kibo/schema";

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
  };
};

export type DeliverInput = { projectId: string; ticketId: string; mode?: DeliveryKind };

export function deliver(_deps: DeliverDeps, _input: DeliverInput): DeliverResult {
  throw new KiboError("AGENT_EXECUTION_REMOVED", "deliver: Kibo no longer runs ticket agents");
}
