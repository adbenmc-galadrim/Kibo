import type { Worktree } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";
import { resolveWorktree, useWorktrees } from "./use-worktrees";

export type ProjectGit = {
  worktrees: Worktree[] | null;
  main: Worktree | null;
  changesCount: number | null;
  error: string | null;
};

export function useProjectGit(projectId: string | null, folder: string | null): ProjectGit {
  const { worktrees, error: worktreesError } = useWorktrees(folder ? projectId : null);
  const main = resolveWorktree(worktrees, null);
  const mainPath = main?.path ?? null;
  const [changesCount, setChangesCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setChangesCount(null);
    setError(null);
    if (!projectId || !mainPath) return;
    let alive = true;
    const load = () =>
      client.code({ method: "status", projectId, worktree: mainPath }).then(
        (s) => {
          if (!alive) return;
          setChangesCount(new Set(s.files.map((f) => f.path)).size);
          setError(null);
        },
        (e: unknown) => {
          if (alive) setError(errorMessage(e));
        },
      );
    void load();
    const off = client.subscribeCode((e) => {
      if (e.projectId === projectId && e.worktree === mainPath) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId, mainPath]);
  const repoError =
    worktreesError && worktreesError.code !== "NOT_A_REPO" ? errorMessage(worktreesError) : null;
  return {
    worktrees: worktrees && worktrees.length > 0 ? worktrees : null,
    main,
    changesCount,
    error: repoError ?? error,
  };
}
