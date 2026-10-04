import type { AgentProfile } from "@kibo/schema";

const systemProfile = (id: string, permissionMode: AgentProfile["permissionMode"]): AgentProfile => ({
  id,
  name: id,
  model: "opus",
  execution: "cli",
  permissionMode,
  workspace: "isolated",
  maxParallel: 1,
  subagents: [],
  enabled: true,
  system: true,
});

export const systemProfilesFixture: AgentProfile[] = [
  systemProfile("assistant", "default"),
  systemProfile("generateur", "acceptEdits"),
  systemProfile("demo", "acceptEdits"),
];
