import { type GuardDecision, PROJECT_AGENT_DENY, type RunView } from "@kibo/schema";
import type { ToolGuard } from "./orchestrator-types";

const DENIED: GuardDecision = { decision: "deny", reason: "the project agent only reads and proposes" };

const isDenied = (tool: string) =>
  PROJECT_AGENT_DENY.some((name) => tool === name || tool.startsWith(`${name}(`));

export function projectRunGuard(run: Pick<RunView, "kind"> | null): ToolGuard | null {
  if (run === null) return null;
  return ({ tool }) => (isDenied(tool) ? DENIED : null);
}
