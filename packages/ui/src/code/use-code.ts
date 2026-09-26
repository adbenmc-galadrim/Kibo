import type {
  ChangeArea,
  CommitDefaults,
  FileDiff,
  GhStatus,
  PrInfo,
  RemoteBranches,
  RepoStatus,
} from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";

function useCodeEvents(projectId: string, worktree: string, onEvent: () => void): void {
  useEffect(
    () =>
      client.subscribeCode((e) => {
        if (e.projectId === projectId && e.worktree === worktree) onEvent();
      }),
    [projectId, worktree, onEvent],
  );
}

export function useCodeStatus(projectId: string, worktree: string) {
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    client.code({ method: "status", projectId, worktree }).then(
      (s) => {
        setStatus(s);
        setError(null);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [projectId, worktree]);
  useEffect(() => reload(), [reload]);
  useCodeEvents(projectId, worktree, reload);
  return { status, error, reload };
}

export function useFileDiff(
  projectId: string,
  worktree: string,
  selection: { path: string; area: ChangeArea } | null,
  origPath: string | null,
  version: string,
) {
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const path = selection?.path ?? null;
  const area = selection?.area ?? null;
  useEffect(() => {
    if (!path || !area || tick < 0 || !version) {
      setDiff(null);
      return;
    }
    let alive = true;
    client.code({ method: "diff", projectId, worktree, path, origPath, area }).then(
      (d) => {
        if (!alive) return;
        setDiff(d);
        setError(null);
      },
      (e: unknown) => {
        if (!alive) return;
        setDiff(null);
        setError(errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, path, area, origPath, version, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { diff, error, reload };
}

export function useCommitDefaults(projectId: string, worktree: string, key: string) {
  const [defaults, setDefaults] = useState<CommitDefaults | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    client.code({ method: "commitDefaults", projectId, worktree }).then(
      (d) => {
        if (!alive) return;
        setDefaults(d);
        setError(null);
      },
      (e: unknown) => {
        if (alive) setError(errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, key]);
  return { defaults, error };
}

export function useRemoteInfo(projectId: string, worktree: string, branch: string | null) {
  const [remote, setRemote] = useState<RemoteBranches | null>(null);
  const [gh, setGh] = useState<GhStatus | null>(null);
  const [pr, setPr] = useState<PrInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick < 0) return;
    let alive = true;
    const fail = (e: unknown) => {
      if (alive) setError(errorMessage(e));
    };
    client.code({ method: "remoteBranches", projectId, worktree }).then((r) => {
      if (alive) setRemote(r);
    }, fail);
    client.code({ method: "ghStatus", projectId, worktree }).then((g) => {
      if (!alive) return;
      setGh(g);
      if (!g.available || !branch) {
        setPr(null);
        return;
      }
      client.code({ method: "prForBranch", projectId, worktree }).then((p) => {
        if (alive) setPr(p);
      }, fail);
    }, fail);
    return () => {
      alive = false;
    };
  }, [projectId, worktree, branch, tick]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { remote, gh, pr, error, refresh };
}

export function useCompare(projectId: string, worktree: string, base: string | null) {
  const [fileCount, setFileCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!base) return;
    let alive = true;
    client.code({ method: "compare", projectId, worktree, base }).then(
      (c) => {
        if (!alive) return;
        setFileCount(c.fileCount);
        setError(null);
      },
      (e: unknown) => {
        if (alive) setError(errorMessage(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, worktree, base]);
  return { fileCount, error };
}
