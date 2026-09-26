import { KiboError, type Worktree } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

type WorktreesState = { worktrees: Worktree[] | null; error: KiboError | null };

export function resolveWorktree(worktrees: Worktree[] | null, path: string | null): Worktree | null {
  if (!worktrees) return null;
  return path ? (worktrees.find((w) => w.path === path) ?? null) : (worktrees.find((w) => w.isMain) ?? null);
}

const asKiboError = (e: unknown) => (e instanceof KiboError ? e : new KiboError("INTERNAL", String(e)));

export function useWorktrees(projectId: string | null): WorktreesState {
  const [state, setState] = useState<WorktreesState>({ worktrees: null, error: null });
  useEffect(() => {
    setState({ worktrees: null, error: null });
    if (!projectId) return;
    let alive = true;
    const load = () =>
      client.code({ method: "worktrees", projectId }).then(
        (worktrees) => {
          if (alive) setState({ worktrees, error: null });
        },
        (e: unknown) => {
          if (alive) setState({ worktrees: [], error: asKiboError(e) });
        },
      );
    void load();
    const off = client.subscribeCode((e) => {
      if (e.projectId === projectId) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId]);
  return state;
}
