import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ChangeArea,
  type CommitInfo,
  type CompareResult,
  type FileChange,
  type FileDiff,
  type GitOperation,
  KiboError,
  type RemoteBranches,
  type RepoStatus,
  Sha,
} from "@kibo/schema";
import { parseDiff } from "./parse-diff";
import { LOG_FORMAT, parseLog } from "./parse-log";
import { type LineCounts, parseNumstat, parseStatus } from "./parse-status";
import { blobSize, headBlob, indexBlob, MAX_FILE_BYTES, optional, worktreeSize } from "./read-file";
import type { WorktreeHandle } from "./repo";
import { firstLine } from "./run";
import { resolveInWorktree } from "./safe-path";

export { MAX_FILE_BYTES, readFile, sha1 } from "./read-file";

export const MAX_DIFF_SIDE_BYTES = 10_000_000;
const MAX_UNPUSHED = 50;
const NO_COUNTS: LineCounts = { additions: null, deletions: null };
const DIFF_FLAGS = ["--no-color", "--no-ext-diff", "--no-textconv", "-U3"];
const REMOTE_NAME = /^[A-Za-z0-9._][A-Za-z0-9._-]*$/;

export async function hasHead(h: WorktreeHandle): Promise<boolean> {
  return (await optional(h, ["rev-parse", "--verify", "-q", "HEAD"])) !== "";
}

export async function isPushed(h: WorktreeHandle, sha: string): Promise<boolean> {
  if (!Sha.safeParse(sha).success) throw new KiboError("INVALID_INPUT", `${sha} is not a commit id`);
  const refs = await h.git.ok(["for-each-ref", `--contains=${sha}`, "--format=%(refname)", "refs/remotes"]);
  return refs.trim().length > 0;
}

export async function currentOperation(h: WorktreeHandle): Promise<GitOperation | null> {
  const has = (name: string) => existsSync(join(h.gitDir, name));
  if (has("rebase-merge") || has("rebase-apply")) return "rebase";
  if (has("MERGE_HEAD")) return "merge";
  if (has("CHERRY_PICK_HEAD")) return "cherry-pick";
  if (has("REVERT_HEAD")) return "revert";
  return null;
}

export async function currentBranch(h: WorktreeHandle): Promise<string | null> {
  return (await optional(h, ["symbolic-ref", "--short", "-q", "HEAD"])) || null;
}

export async function pushRemote(h: WorktreeHandle, branch: string | null): Promise<string | null> {
  const remotes = (await h.git.ok(["remote"])).split("\n").filter((r) => REMOTE_NAME.test(r));
  const configured = branch ? await optional(h, ["config", "--get", `branch.${branch}.remote`]) : "";
  if (remotes.includes(configured)) return configured;
  return remotes.includes("origin") ? "origin" : (remotes[0] ?? null);
}

async function unpushedList(h: WorktreeHandle): Promise<string[]> {
  if (!(await hasHead(h))) return [];
  const out = await h.git.ok(["rev-list", `--max-count=${MAX_UNPUSHED}`, "HEAD", "--not", "--remotes"]);
  return out.split("\n").filter(Boolean);
}

async function log(h: WorktreeHandle, args: string[], unpushed: Set<string>): Promise<CommitInfo[]> {
  return parseLog(await h.git.ok(["log", `--format=${LOG_FORMAT}`, ...args]), (sha) => !unpushed.has(sha));
}

export async function headCommit(h: WorktreeHandle): Promise<CommitInfo> {
  if (!(await hasHead(h))) throw new KiboError("GIT_FAILED", "HEAD has no commit");
  const [commit] = await log(h, ["-1", "HEAD"], new Set(await unpushedList(h)));
  if (!commit) throw new KiboError("GIT_FAILED", "HEAD has no commit");
  return commit;
}

function untrackedCounts(root: string, path: string): LineCounts {
  const abs = join(root, path);
  const stat = lstatSync(abs, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size > MAX_FILE_BYTES) return NO_COUNTS;
  const bytes = new Uint8Array(readFileSync(abs));
  if (bytes.subarray(0, 8000).includes(0)) return NO_COUNTS;
  const text = new TextDecoder().decode(bytes);
  return { additions: text.split("\n").length - (text.endsWith("\n") ? 1 : 0), deletions: 0 };
}

function unstagedCounts(
  h: WorktreeHandle,
  change: FileChange["kind"],
  path: string,
  numstat: Map<string, LineCounts>,
) {
  if (change === "untracked") return untrackedCounts(h.path, path);
  if (change === "conflicted") return NO_COUNTS;
  return numstat.get(path) ?? NO_COUNTS;
}

const byPathThenArea = (a: FileChange, b: FileChange): number => {
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return a.area < b.area ? -1 : a.area > b.area ? 1 : 0;
};

async function listChanges(h: WorktreeHandle, entries: ReturnType<typeof parseStatus>["entries"]) {
  const [staged, unstaged] = await Promise.all([
    h.git.ok(["diff", "--cached", "--numstat", "-z", "-M"]).then(parseNumstat),
    h.git.ok(["diff", "--numstat", "-z"]).then(parseNumstat),
  ]);
  const files: FileChange[] = [];
  for (const e of entries) {
    if (e.staged) {
      const counts = staged.get(e.path) ?? NO_COUNTS;
      files.push({ path: e.path, origPath: e.origPath, area: "staged", kind: e.staged, ...counts });
    }
    if (e.unstaged) {
      const counts = unstagedCounts(h, e.unstaged, e.path, unstaged);
      files.push({ path: e.path, origPath: null, area: "unstaged", kind: e.unstaged, ...counts });
    }
  }
  return files.sort(byPathThenArea);
}

export async function readStatus(h: WorktreeHandle): Promise<RepoStatus> {
  const parsed = parseStatus(
    await h.git.ok(["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all"]),
  );
  const head = parsed.head !== null;
  const files = await listChanges(h, parsed.entries);
  const list = head ? await unpushedList(h) : [];
  const ahead = head
    ? Number((await h.git.ok(["rev-list", "--count", "HEAD", "--not", "--remotes"])).trim())
    : 0;
  const commits = head
    ? await log(h, ["--first-parent", `--max-count=${list.length + 1}`, "HEAD"], new Set(list))
    : [];
  return {
    worktree: h.path,
    branch: parsed.branch,
    upstream: parsed.upstream,
    ahead,
    behind: parsed.behind,
    hasHead: head,
    operation: await currentOperation(h),
    files,
    commits,
  };
}

async function assertDiffable(path: string, sides: Promise<number | null>[]): Promise<void> {
  const largest = Math.max(0, ...(await Promise.all(sides)).map((s) => s ?? 0));
  if (largest > MAX_DIFF_SIDE_BYTES)
    throw new KiboError(
      "INVALID_INPUT",
      `${path} is too large to diff (${largest} bytes, max ${MAX_DIFF_SIDE_BYTES})`,
    );
}

async function stagedDiff(h: WorktreeHandle, path: string, origPath: string | null): Promise<FileDiff> {
  const paths = origPath ? [path, origPath] : [path];
  await assertDiffable(path, [
    ...paths.map((p) => headBlob(h, p).then(blobSize)),
    indexBlob(h, path).then(blobSize),
  ]);
  return parseDiff(await h.git.ok(["diff", "--cached", "-M", ...DIFF_FLAGS, "--", ...paths]), path, origPath);
}

async function untrackedDiff(h: WorktreeHandle, path: string, abs: string): Promise<FileDiff> {
  const size = worktreeSize(abs);
  if (size === null) throw new KiboError("NOT_FOUND", `${path} does not exist`);
  await assertDiffable(path, [Promise.resolve(size)]);
  const r = await h.git.run(["diff", "--no-index", ...DIFF_FLAGS, "--", "/dev/null", path]);
  if (r.code > 1) throw new KiboError("GIT_FAILED", `git diff: ${firstLine(r.stderr)}`);
  return { ...parseDiff(r.stdout, path, null), hunkStaging: false };
}

export async function readDiff(
  h: WorktreeHandle,
  path: string,
  origPath: string | null,
  area: ChangeArea,
): Promise<FileDiff> {
  const abs = resolveInWorktree(h.path, path);
  if (origPath) resolveInWorktree(h.path, origPath);
  if (area === "staged") return stagedDiff(h, path, origPath);
  const index = await indexBlob(h, path);
  if (!index) return untrackedDiff(h, path, abs);
  await assertDiffable(path, [Promise.resolve(index.size), Promise.resolve(worktreeSize(abs))]);
  return parseDiff(await h.git.ok(["diff", ...DIFF_FLAGS, "--", path]), path, null);
}

export async function remoteBranches(h: WorktreeHandle): Promise<RemoteBranches> {
  const remote = await pushRemote(h, await currentBranch(h));
  if (!remote) return { remote: null, branches: [], defaultBase: null };
  const branches = (await h.git.ok(["for-each-ref", "--format=%(refname:strip=3)", `refs/remotes/${remote}`]))
    .split("\n")
    .filter((b) => b && b !== "HEAD");
  const symbolic = await optional(h, ["symbolic-ref", "--short", "-q", `refs/remotes/${remote}/HEAD`]);
  const head = symbolic.slice(remote.length + 1);
  const defaultBase = [head, "main", "master"].find((b) => branches.includes(b)) ?? branches[0] ?? null;
  return { remote, branches, defaultBase };
}

export async function compare(h: WorktreeHandle, base: string): Promise<CompareResult> {
  const { remote, branches } = await remoteBranches(h);
  if (!remote || !branches.includes(base))
    throw new KiboError("INVALID_INPUT", `${base} is not a branch of the remote`);
  const ref = `refs/remotes/${remote}/${base}`;
  const commits = await log(h, ["--max-count=100", `${ref}..HEAD`], new Set(await unpushedList(h)));
  const files = (await h.git.ok(["diff", "--name-only", "-z", `${ref}...HEAD`])).split("\0").filter(Boolean);
  return { commits, fileCount: files.length };
}
