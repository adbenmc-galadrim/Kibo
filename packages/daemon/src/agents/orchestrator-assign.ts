import { existsSync } from "node:fs";
import { guidelineChain } from "@kibo/core/context";
import type { Plan } from "@kibo/core/scheduler";
import { type Agent, KiboError, mainSessionOf, type RunView } from "@kibo/schema";
import { activeRunOf, plannedCwd, previewAssign } from "./assign-preview";
import type { Orchestrator, OrchestratorOptions, TaskSpec } from "./orchestrator-types";
import type { RunRegistry } from "./run-registry";
import type { NewRun } from "./run-store";

export type AssignerDeps = {
  opts: OrchestratorOptions;
  registry: RunRegistry;
  tasks: Map<string, TaskSpec>;
  tick: () => void;
  agentOf: (ref: string) => Agent;
  ticketAgentOf: (ref: string, projectId: string) => Agent;
  plan: (runs: RunView[]) => Plan;
  now: () => number;
  enqueue: (run: NewRun) => RunView;
};

export type Assigner = Pick<Orchestrator, "assign" | "submit" | "preview">;

export function createAssigner({
  opts,
  registry,
  tasks,
  tick,
  agentOf,
  ticketAgentOf,
  plan,
  now,
  enqueue,
}: AssignerDeps): Assigner {
  return {
    assign(input) {
      const agent = ticketAgentOf(input.profileId, input.projectId);
      const { ticket } = opts.data.ticketContext(input.projectId, input.ticketId);
      if (ticket.key === null) throw new KiboError("INVALID_INPUT", "ticket has no key yet");
      if (activeRunOf(registry.all(), ticket.id))
        throw new KiboError("CONFLICT", `ticket ${ticket.key} already has an active run`);
      opts.data.assertWritable(input.projectId);
      opts.data.assignTicket(input.projectId, ticket.id, agent.name);
      const main = mainSessionOf(registry.all(), ticket.id);
      const inherited = !input.fresh && main !== null && main.profileId === agent.ref ? main : null;
      const view = enqueue({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        ticketId: ticket.id,
        ticketKey: ticket.key,
        ticketTitle: ticket.title,
        profileId: agent.ref,
        profileName: agent.name,
        agentScope: agent.scope,
        projectKey: opts.data.projectKey(input.projectId),
        sessionId: inherited?.sessionId ?? crypto.randomUUID(),
        brief: input.brief,
        kind: "ticket",
        resumedFrom: inherited?.id ?? null,
      });
      tick();
      return registry.get(view.id);
    },
    submit(task) {
      const agent = agentOf(task.profileId);
      const id = crypto.randomUUID();
      tasks.set(id, {
        cwd: task.cwd,
        extraArgs: task.extraArgs ?? [],
        env: task.env ?? {},
        resume: task.resumeSessionId !== undefined,
        guard: task.guard,
      });
      enqueue({
        id,
        projectId: task.projectId,
        ticketId: null,
        ticketKey: null,
        ticketTitle: task.title,
        profileId: agent.ref,
        profileName: agent.name,
        agentScope: agent.scope,
        projectKey: task.projectId === null ? null : opts.data.projectKey(task.projectId),
        sessionId: task.resumeSessionId ?? crypto.randomUUID(),
        brief: task.prompt,
        kind: "ticket",
        resumedFrom: null,
      });
      tick();
      return registry.get(id);
    },
    preview(input) {
      const agent = ticketAgentOf(input.profileId, input.projectId);
      const { project, ticket } = opts.data.ticketContext(input.projectId, input.ticketId);
      const key = ticket.key;
      if (key === null) throw new KiboError("INVALID_INPUT", "ticket has no key yet");
      const guidelines = guidelineChain(opts.data.guidelines(input.projectId), {
        projectId: input.projectId,
        domainId: ticket.domainId,
      }).length;
      const runs = registry.all();
      return previewAssign({
        runs,
        projectId: input.projectId,
        ticket: { ...ticket, key },
        agent,
        projectKey: opts.data.projectKey(input.projectId),
        guidelines,
        at: now(),
        plan,
        plannedCwd: plannedCwd(agent.settings.workspace, project.meta, { ...ticket, key }),
        transcriptExists: (path) => path !== null && existsSync(path),
      });
    },
  };
}
