import type { BranchChanges, BranchFile, FileDiff, RemoteBranches } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";

function useBranchChanges(projectId: string, worktree: string, version: string) {
  const [changes, setChanges] = useState<BranchChanges | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!version) return;
    let alive = true;
    client.code({ method: "branchChanges", projectId, worktree }).then(
      (c) => {
        if (!alive) return;
        setChanges(c);
        setError(null);
      },
      (e: unknown) => {
        if (alive) setError(errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, version]);
  return { changes, error };
}

function useBranchDiff(projectId: string, worktree: string, file: BranchFile | null, version: string) {
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = file?.path ?? null;
  const origPath = file?.origPath ?? null;
  useEffect(() => {
    setDiff(null);
    if (!path || !version) return;
    let alive = true;
    client.code({ method: "branchDiff", projectId, worktree, path, origPath }).then(
      (d) => {
        if (!alive) return;
        setDiff(d);
        setError(null);
      },
      (e: unknown) => {
        if (alive) setError(errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, path, origPath, version]);
  return { diff, error };
}

export function useBranchView(projectId: string, worktree: string, version: string, dirty: boolean) {
  const { changes, error } = useBranchChanges(projectId, worktree, version);
  const [picked, setPicked] = useState<string | null>(null);
  const files = changes?.files ?? [];
  const selected = files.find((f) => f.path === picked) ?? (dirty ? null : (files[0] ?? null));
  const diff = useBranchDiff(projectId, worktree, selected, version);
  return {
    changes,
    selected,
    diff: diff.diff,
    error: error ?? diff.error,
    select: (file: BranchFile) => setPicked(file.path),
    clear: () => setPicked(null),
  };
}

export function prBaseOf(branchBase: string | null, remote: RemoteBranches | null): string | null {
  if (!branchBase || !remote?.remote) return null;
  const prefix = `${remote.remote}/`;
  const name = branchBase.startsWith(prefix) ? branchBase.slice(prefix.length) : branchBase;
  return remote.branches.includes(name) ? name : null;
}
