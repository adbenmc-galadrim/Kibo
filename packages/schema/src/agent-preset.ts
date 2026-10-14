import { z } from "zod";
import { AgentSettings, type AgentSettingsPatch } from "./agent";
import { KiboError } from "./errors";

export const AGENT_PRESET_IDS = ["delivery"] as const;
export const AgentPresetId = z.enum(AGENT_PRESET_IDS);
export type AgentPresetId = z.infer<typeof AgentPresetId>;

export const DELIVERY_ALLOW_DEFAULTS: readonly string[] = [
  "Bash(pnpm *)",
  "Bash(docker compose *)",
  "Bash(npx playwright *)",
  "Bash(git *)",
  "Bash(gh pr create --draft*)",
  "Bash(gh pr view*)",
  "Bash(gh pr list*)",
  "Bash(gh pr diff*)",
  "Bash(gh pr checks*)",
  "Bash(gh pr comment*)",
  "Bash(delivery-plan *)",
  "Bash(delivery-step *)",
  "Bash(delivery-slot *)",
  "Bash(delivery-worktree *)",
  "Bash(delivery-project *)",
  "Bash(kibo *)",
];

export function presetPatch(id: AgentPresetId, home: string): AgentSettingsPatch {
  switch (id) {
    case "delivery":
      return {
        permissionMode: "auto",
        allSubagents: true,
        workspace: "worktree",
        skills: { mode: "all" },
        allow: [...DELIVERY_ALLOW_DEFAULTS],
        addDirs: [`${home}/.claude/skills`],
      };
  }
}

const union = (a: readonly string[], b: readonly string[] | undefined): string[] => [
  ...new Set([...a, ...(b ?? [])]),
];

export function applyPreset(current: AgentSettings, patch: AgentSettingsPatch): AgentSettings {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  const parsed = AgentSettings.safeParse({
    ...current,
    ...defined,
    allow: union(current.allow, patch.allow),
    addDirs: union(current.addDirs, patch.addDirs),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new KiboError(
      "INVALID_INPUT",
      `preset: ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`.trim(),
    );
  }
  return parsed.data;
}
