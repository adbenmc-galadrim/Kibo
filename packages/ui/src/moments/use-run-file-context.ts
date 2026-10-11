import type { RunView } from "@kibo/schema";
import { owningWorktree } from "../code/agent-slots";
import { useWorktrees } from "../code/use-worktrees";
import type { FileContext } from "./file-context";

export function useRunFileContext(run: RunView | null): FileContext | null {
  const local = run?.cwd && run.workspace !== "isolated" ? run : null;
  const { worktrees } = useWorktrees(local?.projectId ?? null);
  if (!local?.projectId || !local.cwd || !worktrees) return null;
  const worktree = owningWorktree(
    worktrees.map((w) => w.path),
    local.cwd,
  );
  if (!worktree) return null;
  return {
    projectId: local.projectId,
    worktree,
    origin: `${local.ticketKey ?? local.label} · ${local.label}`,
  };
}
