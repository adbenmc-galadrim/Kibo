import { KiboError, type Worktree } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

type WorktreesState = { worktrees: Worktree[] | null; error: KiboError | null };

export const GIT_RETRY_MS = 5_000;

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
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      clearTimeout(retry);
      client.code({ method: "worktrees", projectId }).then(
        (worktrees) => {
          if (alive) setState({ worktrees, error: null });
        },
        (e: unknown) => {
          if (!alive) return;
          const error = asKiboError(e);
          if (error.code !== "NOT_A_REPO") retry = setTimeout(load, GIT_RETRY_MS);
          setState((s) => ({ worktrees: error.code === "NOT_A_REPO" ? [] : s.worktrees, error }));
        },
      );
    };
    load();
    const off = client.subscribeCode((e) => {
      if (e.projectId === projectId) load();
    });
    return () => {
      alive = false;
      clearTimeout(retry);
      off();
    };
  }, [projectId]);
  return state;
}
