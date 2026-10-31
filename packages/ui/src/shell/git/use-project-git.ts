import type { Worktree } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { errorMessage } from "../../lib/error-message";
import { GIT_RETRY_MS, resolveWorktree, useWorktrees } from "./use-worktrees";

type ProjectGit = {
  worktrees: Worktree[] | null;
  main: Worktree | null;
  hasRepo: boolean;
  changesCount: number | null;
  error: string | null;
};

function useChangesCount(projectId: string | null, mainPath: string | null) {
  const [changesCount, setChangesCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setChangesCount(null);
    setError(null);
    if (!projectId || !mainPath) return;
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      clearTimeout(retry);
      client.code({ method: "status", projectId, worktree: mainPath }).then(
        (s) => {
          if (!alive) return;
          setChangesCount(new Set(s.files.map((f) => f.path)).size);
          setError(null);
        },
        (e: unknown) => {
          if (!alive) return;
          setError(errorMessage(e));
          retry = setTimeout(load, GIT_RETRY_MS);
        },
      );
    };
    load();
    const off = client.subscribeCode((e) => {
      if (e.projectId === projectId && e.worktree === mainPath) load();
    });
    return () => {
      alive = false;
      clearTimeout(retry);
      off();
    };
  }, [projectId, mainPath]);
  return { changesCount, error };
}

export function useProjectGit(projectId: string | null, folder: string | null): ProjectGit {
  const { worktrees, error: worktreesError } = useWorktrees(folder ? projectId : null);
  const main = resolveWorktree(worktrees, null);
  const { changesCount, error } = useChangesCount(projectId, main?.path ?? null);
  const repoError =
    worktreesError && worktreesError.code !== "NOT_A_REPO" ? errorMessage(worktreesError) : null;
  const known = worktrees && worktrees.length > 0 ? worktrees : null;
  return {
    worktrees: known,
    main,
    hasRepo: known !== null || repoError !== null,
    changesCount,
    error: repoError ?? error,
  };
}
