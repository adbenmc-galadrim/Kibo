import type { ProjectSnapshot, RunState, RunView, Worktree } from "@kibo/schema";
import { useAgents } from "../state/use-agents";
import type { ChangesSlots } from "./changes-slots";

const WORKING: readonly RunState[] = ["running", "waiting_input"];

const isInside = (root: string, path: string): boolean =>
  path === root || path.startsWith(root.endsWith("/") ? root : `${root}/`);

export function owningWorktree(worktrees: string[], path: string): string | null {
  return worktrees
    .filter((w) => isInside(w, path))
    .reduce<string | null>((best, w) => (best === null || w.length > best.length ? w : best), null);
}

export function agentInWorktree(
  runs: RunView[],
  projectId: string,
  worktree: string,
  worktrees: string[],
): RunView | null {
  const owns = (cwd: string | null) => cwd !== null && owningWorktree(worktrees, cwd) === worktree;
  return runs.find((r) => r.projectId === projectId && WORKING.includes(r.state) && owns(r.cwd)) ?? null;
}

export function useChangesSlots(
  project: ProjectSnapshot,
  worktree: string | null,
  ticketKey: string | null,
  worktrees: Worktree[],
): ChangesSlots {
  const agents = useAgents();
  const paths = worktrees.map((w) => w.path);
  const agent = worktree ? agentInWorktree(agents?.runs ?? [], project.meta.id, worktree, paths) : null;
  const ruleActive = project.rules.some((r) => r.enabled && r.when === "pr_opened");
  return {
    workingAgent: agent?.label ?? null,
    prRuleKey: ticketKey && ruleActive ? ticketKey : null,
  };
}
