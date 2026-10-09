import { headRank } from "@kibo/core/scheduler";
import {
  type AgentProfile,
  isProjectRun,
  isTerminal,
  KiboError,
  PROJECT_AGENT_DENY,
  PROJECT_AGENT_MCP_TOOLS,
  PROJECT_AGENT_PROFILE_ID,
  PROJECT_AGENT_READ_TOOLS,
  type RunView,
} from "@kibo/schema";
import { type HookLauncher, writeMcpConfig } from "./hook-launcher";
import type { ProjectRunInput, ProjectTurnPort } from "./orchestrator-types";
import type { RunRegistry } from "./run-registry";
import { writeRunContext } from "./workspace-prep";

export const PROJECT_WORKSPACE_LABEL = "projet";

type CreateDeps = {
  registry: RunRegistry;
  profileOf: (profileId: string) => AgentProfile;
  assertWritable: (projectId: string) => void;
};

export function createProjectRun(
  { registry, profileOf, assertWritable }: CreateDeps,
  input: ProjectRunInput,
): string {
  const agent = profileOf(PROJECT_AGENT_PROFILE_ID);
  assertWritable(input.projectId);
  const open = registry
    .all()
    .some((r) => isProjectRun(r) && r.projectId === input.projectId && !isTerminal(r.state));
  if (open) throw new KiboError("CONFLICT", `project ${input.projectId} already has an open project run`);
  const id = crypto.randomUUID();
  registry.create(
    {
      id,
      projectId: input.projectId,
      ticketId: null,
      ticketKey: null,
      ticketTitle: `Agent de projet · ${input.projectName}`,
      profileId: agent.id,
      profileName: agent.name,
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

export type PreparedProjectTurn = { cwd: string; prompt: string; systemPromptFile: string };

export async function prepareProjectTurn(
  port: ProjectTurnPort,
  run: RunView,
  runDir: string,
): Promise<PreparedProjectTurn> {
  const turn = await port.prepare(run, runDir);
  const { systemPromptFile } = writeRunContext(runDir, [
    { path: "CLAUDE.md", content: turn.systemPrompt },
    { path: "brief.md", content: turn.prompt },
  ]);
  return { cwd: turn.cwd, prompt: turn.prompt, systemPromptFile };
}

export type ProjectLaunch = {
  allow: string[];
  deny: readonly string[];
  mcpUrl: string;
  mcpConfigFile: string;
};

export function projectLaunch(input: {
  profile: AgentProfile;
  baseUrl: string;
  runId: string;
  runDir: string;
  hook: HookLauncher;
  token: string;
}): ProjectLaunch {
  const mcpUrl = `${input.baseUrl}/agent-mcp/${input.runId}`;
  return {
    allow: [...PROJECT_AGENT_MCP_TOOLS, ...PROJECT_AGENT_READ_TOOLS, ...input.profile.allow],
    deny: PROJECT_AGENT_DENY,
    mcpUrl,
    mcpConfigFile: writeMcpConfig(input.runDir, input.hook, {
      KIBO_MCP_URL: mcpUrl,
      KIBO_RUN_TOKEN: input.token,
    }),
  };
}
