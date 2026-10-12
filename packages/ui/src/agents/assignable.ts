import { type AgentSummary, DEMO_AGENT_REF } from "@kibo/schema";

const usable = (a: AgentSummary): boolean =>
  a.settings.enabled && a.shadowedBy === null && a.problem === null;

export const isDemoAgent = (a: Pick<AgentSummary, "ref">): boolean => a.ref === DEMO_AGENT_REF;

export function assignableAgents(agents: readonly AgentSummary[], demoProject: boolean): AgentSummary[] {
  const own = agents.filter((a) => usable(a) && a.scope !== "system");
  const demo = demoProject ? agents.find((a) => isDemoAgent(a) && usable(a)) : undefined;
  return demo ? [demo, ...own] : own;
}
