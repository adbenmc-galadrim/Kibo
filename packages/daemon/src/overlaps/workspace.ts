import { realpath } from "node:fs/promises";
import { basename } from "node:path";
import { DUPLICATION_LIMITS, type RunView } from "@kibo/schema";
import type { GitRunner } from "../agents/workspace-prep";

export type WorkspaceRef = {
  key: string;
  kind: "worktree" | "repo";
  worktreeName: string | null;
  baseHead: string;
};

const kindOf = (label: string | null): WorkspaceRef["kind"] | null => {
  if (label === "repo") return "repo";
  return label?.startsWith("worktree:") ? "worktree" : null;
};

const realFolder = (path: string): Promise<string | null> => realpath(path).catch(() => null);

export async function workspaceOf(
  run: RunView,
  git: GitRunner,
  baseHeadOf: (runId: string) => string | null,
  log: (line: string) => void,
): Promise<WorkspaceRef | null> {
  const kind = kindOf(run.workspace);
  if (run.kind !== "ticket" || !run.cwd || !kind) return null;
  const key = await realFolder(run.cwd);
  if (!key) return null;
  const top = await git(["rev-parse", "--show-toplevel"], key, DUPLICATION_LIMITS.gitTimeoutMs);
  if (top.code !== 0) return null;
  const baseHead = baseHeadOf(run.id);
  if (!baseHead) {
    log(`overlaps: détection partielle, run ${run.id} has no base head`);
    return null;
  }
  return { key, kind, worktreeName: kind === "worktree" ? basename(key) : null, baseHead };
}
