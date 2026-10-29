import { commandsFor, type TicketIds } from "@kibo/core/project-agent/apply-plan";
import type { BatchContext } from "@kibo/core/project-agent/expected";
import {
  type Actor,
  KiboError,
  type ProjectEventSink,
  type ProposedAction,
  Question,
  Ticket,
} from "@kibo/schema";
import { assertTicketExecution } from "../agents/execution-removed";
import type { ProjectAgentAgentsPort, ProjectAgentDataPort } from "./types";

export type Created = { ticketId: string; key: string };

export type ActionRunnerDeps = {
  data: ProjectAgentDataPort;
  projectId: string;
  by: Actor;
  ctx: BatchContext;
  refs: Map<string, Created>;
  agents?: () => ProjectAgentAgentsPort;
  events?: ProjectEventSink;
};

function createdTicket(deps: ActionRunnerDeps, out: unknown): Created {
  const { id } = Ticket.parse(out);
  const ticket = deps.data.project(deps.projectId).tickets.find((t) => t.id === id);
  if (!ticket) throw new KiboError("INTERNAL", `created ticket ${id} vanished`);
  return { ticketId: id, key: ticket.key ?? ticket.keyLabel };
}

function idOf(ids: TicketIds, ref: string): string {
  const id = ids[ref];
  if (id === undefined) throw new KiboError("INTERNAL", `unresolved ticket reference ${ref}`);
  return id;
}

const readsFreshProject = (action: ProposedAction): boolean =>
  action.type === "setSprint" ||
  ((action.type === "createQuestion" || action.type === "updateQuestion") && action.recipient !== undefined);

const projectFor = (deps: ActionRunnerDeps, action: ProposedAction) =>
  readsFreshProject(action) ? deps.data.project(deps.projectId) : deps.ctx.project;

function rootOf(deps: ActionRunnerDeps, ticketId: string): string {
  const byId = new Map(deps.data.project(deps.projectId).tickets.map((t) => [t.id, t]));
  let current = byId.get(ticketId);
  while (current?.parentId) current = byId.get(current.parentId);
  return current?.id ?? ticketId;
}

function recordReminder(deps: ActionRunnerDeps, out: unknown): void {
  const question = Question.parse(out);
  deps.events?.record(deps.projectId, {
    kind: "question_reminded",
    ticketId: question.ticketId,
    featureId: rootOf(deps, question.ticketId),
    source: "project-agent",
    data: { questionId: question.id, title: question.title },
  });
}

function batchAgents(
  deps: ActionRunnerDeps,
  action: ProposedAction,
): NonNullable<ActionRunnerDeps["agents"]> {
  if (!deps.agents) throw new KiboError("INTERNAL", `${action.type} is not available outside a batch`);
  return deps.agents;
}

const agentsOf = (deps: ActionRunnerDeps, action: ProposedAction): ProjectAgentAgentsPort =>
  batchAgents(deps, action)();

function runCommands(deps: ActionRunnerDeps, action: ProposedAction, ids: TicketIds): Created | null {
  let created: Created | null = null;
  for (const command of commandsFor(action, ids, deps.by, projectFor(deps, action))) {
    const out = deps.data.runCommand(deps.projectId, command);
    if (command.method === "createTicket") created = createdTicket(deps, out);
    if (command.method === "remindQuestion") recordReminder(deps, out);
  }
  return created;
}

export async function runAction(
  deps: ActionRunnerDeps,
  action: ProposedAction,
  ids: TicketIds,
): Promise<Created | null> {
  const { data, projectId } = deps;
  switch (action.type) {
    case "assignAgent": {
      const agents = agentsOf(deps, action);
      assertTicketExecution(agents.ticketExecution(), "assignAgent");
      agents.assign({
        projectId,
        ticketId: idOf(ids, action.ticket),
        profileId: action.profileId,
        brief: action.brief ?? "",
        ...(action.fresh !== undefined && { fresh: action.fresh }),
      });
      return null;
    }
    case "deliverAnswers": {
      const agents = agentsOf(deps, action);
      assertTicketExecution(agents.ticketExecution(), "deliverAnswers");
      agents.deliverAnswers(projectId, idOf(ids, action.ticket));
      return null;
    }
    case "cancelRun":
      agentsOf(deps, action).cancel(action.runId);
      return null;
    case "createNote":
    case "updateNote":
      batchAgents(deps, action);
      await data.writeNote(
        projectId,
        action.path,
        action.content,
        action.type === "createNote" ? "create" : "update",
      );
      return null;
    default:
      return runCommands(deps, action, ids);
  }
}
