import {
  executeProjectCommand,
  getKeyAllocator,
  listProjectDomainGuidelines,
  listProjectDomains,
  listTickets,
  readProject,
} from "@kibo/core";
import { listDomains, listGuidelines, listProfiles } from "@kibo/core/agent-config";
import { evaluateRules, type RuleTrigger, readRules } from "@kibo/core/rules";
import { KiboError, type ProjectCommand } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import type { Docs } from "../docs";
import type { AgentDataPort } from "./orchestrator";

export function applyRules(doc: LoroDoc, trigger: RuleTrigger): ProjectCommand[] {
  const commands = evaluateRules(readRules(doc), trigger, listTickets(doc));
  for (const command of commands) executeProjectCommand(doc, command);
  return commands;
}

const isShared = (doc: LoroDoc) => getKeyAllocator(doc) === "server";

function domainsOf(docs: Docs, projectId: string) {
  const doc = docs.project(projectId);
  return isShared(doc) ? listProjectDomains(doc) : listDomains(docs.workspace);
}

function guidelinesOf(docs: Docs, projectId: string) {
  const doc = docs.project(projectId);
  const workspace = listGuidelines(docs.workspace);
  if (!isShared(doc)) return [...workspace, ...listGuidelines(doc)];
  const outsideDomains = workspace.filter((g) => g.owner.scope !== "domain");
  return [...outsideDomains, ...listProjectDomainGuidelines(doc), ...listGuidelines(doc)];
}

export function createDataPort(docs: Docs): AgentDataPort {
  return {
    profiles: () => listProfiles(docs.workspace),
    ticketContext(projectId, ticketId) {
      const project = { ...readProject(docs.project(projectId)), meta: docs.projectMeta(projectId) };
      const ticket = project.tickets.find((t) => t.id === ticketId);
      if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${ticketId} not found`);
      const domain = domainsOf(docs, projectId).find((d) => d.id === ticket.domainId) ?? null;
      return { project, ticket, domain };
    },
    guidelines: (projectId) => guidelinesOf(docs, projectId),
    assignTicket(projectId, ticketId, profileName) {
      docs.run(projectId, {
        method: "updateTicket",
        ticketId,
        assignee: { kind: "agent", ref: profileName },
      });
    },
    runStarted(projectId, ticketId) {
      docs.trigger(projectId, { kind: "run_started", ticketId });
    },
    runDone(projectId, ticketId) {
      docs.trigger(projectId, { kind: "run_done", ticketId });
    },
  };
}
