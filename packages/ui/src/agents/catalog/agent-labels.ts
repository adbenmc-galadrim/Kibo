import {
  type AgentScope,
  type AgentSummary,
  isReservedAgentName,
  type ProjectSummary,
  type RunView,
} from "@kibo/schema";
import { frAgentsSkills } from "../../i18n/fr-agents-skills";

export type AgentStatus = "ok" | "shadowed" | "unreadable" | "reserved";
type ProjectName = Pick<ProjectSummary, "id" | "name">;

const t = frAgentsSkills.scopes;
const MODEL_LABELS: Record<string, string> = {
  opus: frAgentsSkills.models.opus,
  sonnet: frAgentsSkills.models.sonnet,
  haiku: frAgentsSkills.models.haiku,
};

export function projectName(projectId: string | null, projects: readonly ProjectName[]): string {
  return projects.find((p) => p.id === projectId)?.name ?? t.unknownProject;
}

export function scopeText(
  agent: { scope: AgentScope; projectId: string | null },
  projects: readonly ProjectName[],
): string {
  if (agent.scope === "global") return t.global;
  if (agent.scope === "system") return t.system;
  return t.project(projectName(agent.projectId, projects));
}

export function runScopeText(run: Pick<RunView, "agentScope" | "projectKey">): string {
  if (run.agentScope === "global") return t.global;
  if (run.agentScope === "system") return t.system;
  return t.project(run.projectKey ?? t.unknownProject);
}

export function modelText(model: string | null): string {
  if (model === null || model === "inherit") return frAgentsSkills.models.inherited;
  return MODEL_LABELS[model] ?? model;
}

export function agentStatus(
  agent: Pick<AgentSummary, "name" | "scope" | "problem" | "shadowedBy">,
): AgentStatus {
  if (agent.problem !== null) return "unreadable";
  if (agent.shadowedBy !== null) return "shadowed";
  if (agent.scope !== "system" && isReservedAgentName(agent.name)) return "reserved";
  return "ok";
}
