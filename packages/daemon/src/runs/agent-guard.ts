import type { GuardDecision } from "@kibo/schema";
import type { ToolGuard } from "./orchestrator-types";

const SUBAGENT_TOOLS = new Set(["Agent", "Task"]);
const SKILL_TOOL = "Skill";

const deny = (reason: string): GuardDecision => ({ decision: "deny", reason });

export const closedGuard: ToolGuard = ({ tool }) => {
  if (SUBAGENT_TOOLS.has(tool)) return deny("sous-agent non autorisé par Kibo");
  if (tool === SKILL_TOOL) return deny("skill non autorisé par Kibo");
  return null;
};
