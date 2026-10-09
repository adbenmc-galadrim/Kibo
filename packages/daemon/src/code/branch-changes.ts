import {
  type BranchChanges,
  type BranchFile,
  type CommitInfo,
  type FileDiff,
  isGitBranchName,
  KiboError,
  Sha,
} from "@kibo/schema";
import { parseDiff } from "./parse-diff";
import { LOG_FORMAT, parseLog } from "./parse-log";
import { parseNameStatus, parseNumstat } from "./parse-status";
import { assertDiffable, DIFF_FLAGS, hasHead, remoteBranches } from "./read";
import { blobSize, optional, revBlob } from "./read-file";
import type { WorktreeHandle } from "./repo";
import { firstLine } from "./run";
import { resolveInWorktree } from "./safe-path";

export type BranchBase = { name: string; ref: string };

const MAX_BRANCH_COMMITS = 100;
const MAX_UNPUSHED_SCAN = 1000;
const NO_CHANGES: BranchChanges = {
  base: null,
  mergeBase: null,
  files: [],
  additions: 0,
  deletions: 0,
  commits: [],
};

const refExists = async (h: WorktreeHandle, ref: string): Promise<boolean> =>
  (await optional(h, ["rev-parse", "--verify", "-q", `${ref}^{commit}`])) !== "";

async function lookup(h: WorktreeHandle, candidate: string, remote: string | null) {
  if (!isGitBranchName(candidate)) return null;
  const options: BranchBase[] = [
    { name: candidate, ref: `refs/remotes/${candidate}` },
    ...(remote ? [{ name: `${remote}/${candidate}`, ref: `refs/remotes/${remote}/${candidate}` }] : []),
    { name: candidate, ref: `refs/heads/${candidate}` },
  ];
  for (const option of options) if (await refExists(h, option.ref)) return option;
  return null;
}

export async function resolveBranchBase(
  h: WorktreeHandle,
  candidates: readonly (string | null)[],
): Promise<BranchBase | null> {
  const { remote, defaultBase } = await remoteBranches(h);
  const fallback = remote && defaultBase ? `${remote}/${defaultBase}` : null;
  for (const candidate of [...candidates, fallback]) {
    const found = candidate ? await lookup(h, candidate, remote) : null;
    if (found) return found;
  }
  return null;
}

async function mergeBaseOf(h: WorktreeHandle, base: BranchBase): Promise<string | null> {
  if (!(await hasHead(h))) return null;
  const r = await h.git.run(["merge-base", base.ref, "HEAD"]);
  if (r.code === 1) return null;
  if (r.code !== 0) throw new KiboError("GIT_FAILED", `git merge-base: ${firstLine(r.stderr)}`);
  const sha = r.stdout.trim();
  return Sha.safeParse(sha).success ? sha : null;
}

async function changedFiles(h: WorktreeHandle, mergeBase: string): Promise<BranchFile[]> {
  const [names, counts] = await Promise.all([
    h.git.ok(["diff", "--name-status", "-z", "-M", mergeBase, "HEAD"]).then(parseNameStatus),
    h.git.ok(["diff", "--numstat", "-z", "-M", mergeBase, "HEAD"]).then(parseNumstat),
  ]);
  return names
    .map((n) => ({ ...n, ...(counts.get(n.path) ?? { additions: null, deletions: null }) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

async function branchCommits(h: WorktreeHandle, base: BranchBase): Promise<CommitInfo[]> {
  const unpushed = new Set(
    (await h.git.ok(["rev-list", `--max-count=${MAX_UNPUSHED_SCAN}`, "HEAD", "--not", "--remotes"]))
      .split("\n")
      .filter(Boolean),
  );
  const raw = await h.git.ok([
    "log",
    `--format=${LOG_FORMAT}`,
    `--max-count=${MAX_BRANCH_COMMITS}`,
    `${base.ref}..HEAD`,
  ]);
  return parseLog(raw, (sha) => !unpushed.has(sha));
}

const sum = (files: BranchFile[], key: "additions" | "deletions"): number =>
  files.reduce((total, f) => total + (f[key] ?? 0), 0);

export async function branchChanges(
  h: WorktreeHandle,
  candidates: readonly (string | null)[],
): Promise<BranchChanges> {
  const base = await resolveBranchBase(h, candidates);
  const mergeBase = base ? await mergeBaseOf(h, base) : null;
  if (!base || !mergeBase) return { ...NO_CHANGES, base: base?.name ?? null };
  const [files, commits] = await Promise.all([changedFiles(h, mergeBase), branchCommits(h, base)]);
  return {
    base: base.name,
    mergeBase,
    files,
    additions: sum(files, "additions"),
    deletions: sum(files, "deletions"),
    commits,
  };
}

export async function branchDiff(
  h: WorktreeHandle,
  candidates: readonly (string | null)[],
  path: string,
  origPath: string | null,
): Promise<FileDiff> {
  resolveInWorktree(h.path, path);
  if (origPath) resolveInWorktree(h.path, origPath);
  const base = await resolveBranchBase(h, candidates);
  const mergeBase = base ? await mergeBaseOf(h, base) : null;
  if (!mergeBase) throw new KiboError("NOT_FOUND", "the branch has no base to compare with");
  const paths = origPath ? [path, origPath] : [path];
  await assertDiffable(
    path,
    paths.flatMap((p) => [revBlob(h, mergeBase, p).then(blobSize), revBlob(h, "HEAD", p).then(blobSize)]),
  );
  const raw = await h.git.ok(["diff", "-M", ...DIFF_FLAGS, mergeBase, "HEAD", "--", ...paths]);
  return { ...parseDiff(raw, path, origPath), hunkStaging: false };
}
