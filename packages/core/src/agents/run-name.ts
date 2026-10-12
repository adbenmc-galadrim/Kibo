import type { AgentScope } from "@kibo/schema";

const SEP = " · ";

export function scopeLabel(scope: AgentScope, projectKey: string | null): string {
  if (scope === "global") return "global";
  if (projectKey) return projectKey.toLowerCase();
  return scope === "system" ? "kibo" : "projet";
}

export function runName(input: {
  agentScope: AgentScope;
  agentName: string;
  projectKey: string | null;
  ticketKey: string | null;
}): string {
  const parts = [scopeLabel(input.agentScope, input.projectKey), input.agentName];
  return (input.ticketKey ? [...parts, input.ticketKey] : parts).join(SEP);
}
