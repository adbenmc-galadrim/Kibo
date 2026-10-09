import { type AgentProfile, PROJECT_AGENT_PROFILE_ID } from "@kibo/schema";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { frProjectAgent } from "../i18n/fr-project-agent";

export const DEMO_PROFILE_ID = "demo";

export const isDemoProfile = (profile: Pick<AgentProfile, "id">): boolean => profile.id === DEMO_PROFILE_ID;

export const isProjectAgentProfile = (profile: Pick<AgentProfile, "id">): boolean =>
  profile.id === PROJECT_AGENT_PROFILE_ID;

export const profileLabel = (profile: Pick<AgentProfile, "id" | "name">): string =>
  isDemoProfile(profile)
    ? frAgentsPage.demo.name
    : isProjectAgentProfile(profile)
      ? frProjectAgent.profile.name
      : profile.name;

export function assignableProfiles(profiles: readonly AgentProfile[], demoProject: boolean): AgentProfile[] {
  const own = profiles.filter((p) => !p.system);
  const agent = demoProject ? profiles.find(isDemoProfile) : undefined;
  return agent ? [agent, ...own] : own;
}
