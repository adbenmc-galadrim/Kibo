import { executeProjectCommand, listTickets, readProject } from "@kibo/core";
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

export function createDataPort(docs: Docs): AgentDataPort {
  const changed = (projectId: string) => {
    docs.save(projectId);
    docs.emit({ projectId });
  };
  return {
    profiles: () => listProfiles(docs.workspace),
    ticketContext(projectId, ticketId) {
      const project = readProject(docs.project(projectId));
      const ticket = project.tickets.find((t) => t.id === ticketId);
      if (!ticket) throw new KiboError("NOT_FOUND", `ticket ${ticketId} not found`);
      const domain = listDomains(docs.workspace).find((d) => d.id === ticket.domainId) ?? null;
      return { project, ticket, domain };
    },
    guidelines: (projectId) => [
      ...listGuidelines(docs.workspace),
      ...listGuidelines(docs.project(projectId)),
    ],
    assignTicket(projectId, ticketId, profileName) {
      executeProjectCommand(docs.project(projectId), {
        method: "updateTicket",
        ticketId,
        assignee: { kind: "agent", ref: profileName },
      });
      changed(projectId);
    },
    runDone(projectId, ticketId) {
      if (applyRules(docs.project(projectId), { kind: "run_done", ticketId }).length > 0) changed(projectId);
    },
  };
}
