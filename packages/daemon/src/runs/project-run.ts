import { headRank } from "@kibo/core/scheduler";
import {
  type Agent,
  isTerminal,
  KiboError,
  PROJECT_AGENT_DENY,
  PROJECT_AGENT_MCP_TOOLS,
  PROJECT_AGENT_READ_TOOLS,
  PROJECT_AGENT_REF,
} from "@kibo/schema";
import { type McpLaunch, type McpLaunchInput, mcpRoute } from "./mcp-launch";
import type { ProjectRunInput } from "./orchestrator-types";
import type { RunRegistry } from "./run-registry";

export const PROJECT_WORKSPACE_LABEL = "projet";

type CreateDeps = {
  registry: RunRegistry;
  agentOf: (ref: string) => Agent;
  projectKey: (projectId: string) => string | null;
};

export function createProjectRun(
  { registry, agentOf, projectKey }: CreateDeps,
  input: ProjectRunInput,
): string {
  const agent = agentOf(PROJECT_AGENT_REF);
  const open = registry.all().some((r) => r.projectId === input.projectId && !isTerminal(r.state));
  if (open) throw new KiboError("CONFLICT", `project ${input.projectId} already has an open project run`);
  const id = crypto.randomUUID();
  registry.create(
    {
      id,
      projectId: input.projectId,
      ticketId: null,
      ticketKey: null,
      ticketTitle: `Agent de projet · ${input.projectName}`,
      profileId: agent.ref,
      profileName: agent.name,
      agentScope: agent.scope,
      projectKey: projectKey(input.projectId),
      sessionId: crypto.randomUUID(),
      brief: "",
      kind: "project",
      resumedFrom: null,
    },
    headRank(registry.all()),
  );
  registry.apply(id, { type: "prioritized", priority: true });
  registry.apply(id, { type: "answered", text: input.text, rank: headRank(registry.all()) });
  return id;
}

type ProjectLaunch = McpLaunch;

export function projectLaunch(input: McpLaunchInput): ProjectLaunch {
  return {
    allow: [...PROJECT_AGENT_MCP_TOOLS, ...PROJECT_AGENT_READ_TOOLS, ...input.agent.settings.allow],
    deny: PROJECT_AGENT_DENY,
    ...mcpRoute(input, "project"),
  };
}
