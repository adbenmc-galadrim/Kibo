import { type GuardDecision, type SkillsRule, skillTarget } from "@kibo/schema";

export { skillTarget } from "@kibo/schema";

export const GENERIC_SUBAGENTS = ["general-purpose", "Explore", "Plan"] as const;
const SUBAGENT_TOOLS = ["Agent", "Task"];
const SKILL_TOOL = "Skill";

export type GuardRules = { subagents: readonly string[]; genericSubagents: boolean; skills: SkillsRule };
export type GuardCall = { tool: string; input: Record<string, unknown> };

const deny = (reason: string, target: string | null): GuardDecision => ({
  decision: "deny",
  reason: target ? `${reason} : ${target}` : reason,
});

function subagentDecision(rules: GuardRules, input: Record<string, unknown>): GuardDecision | null {
  const type = typeof input.subagent_type === "string" ? input.subagent_type : null;
  const generic = rules.genericSubagents && GENERIC_SUBAGENTS.some((g) => g === type);
  if (type !== null && (generic || rules.subagents.includes(type))) return null;
  return deny("sous-agent non autorisé par Kibo", type);
}

function skillDecision(rules: GuardRules, input: Record<string, unknown>): GuardDecision | null {
  if (rules.skills.mode === "all") return null;
  const id = skillTarget(input);
  if (id !== null && rules.skills.ids.includes(id)) return null;
  return deny("skill non autorisé par Kibo", id);
}

export function agentGuard(rules: GuardRules): (call: GuardCall) => GuardDecision | null {
  return (call) => {
    if (SUBAGENT_TOOLS.includes(call.tool)) return subagentDecision(rules, call.input);
    if (call.tool === SKILL_TOOL) return skillDecision(rules, call.input);
    return null;
  };
}
