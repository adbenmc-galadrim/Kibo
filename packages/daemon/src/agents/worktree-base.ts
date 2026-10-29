import { type BaseFallback, KiboError, splitRemote, WORKTREE_DEFAULTS } from "@kibo/schema";
import type { GitRunner } from "../runs/workspace-prep";

export const FETCH_TIMEOUT_MS = 60_000;
export type BaseStart = { start: string; fallback: BaseFallback | null };
type Lookup = { found: true; start: string } | { found: false; remote: string | null };

const gitFailed = (detail: string) => new KiboError("GIT_FAILED", detail);
const found = (start: string): Lookup => ({ found: true, start });
const ABSENT_FROM_REMOTE = 2;

export const hasLocalBranch = async (root: string, branch: string, git: GitRunner): Promise<boolean> =>
  (await git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], root)).code === 0;

const hasCommit = async (root: string, ref: string, git: GitRunner): Promise<boolean> =>
  (await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], root)).code === 0;

async function remotesOf(root: string, git: GitRunner): Promise<string[]> {
  const res = await git(["remote"], root);
  return res.stdout.split("\n").filter((name) => name.length > 0);
}

function defaultRemote(remotes: readonly string[]): string | null {
  if (remotes.includes("origin")) return "origin";
  return remotes.length === 1 ? (remotes[0] ?? null) : null;
}

async function fetchInto(root: string, remote: string, refspec: string, git: GitRunner): Promise<void> {
  const fetched = await git(["fetch", "--quiet", "--", remote, refspec], root, FETCH_TIMEOUT_MS);
  if (fetched.code !== 0) throw gitFailed(`git fetch ${remote} ${refspec} failed: ${fetched.stderr.trim()}`);
}

async function lookupOnRemote(root: string, remote: string, branch: string, git: GitRunner): Promise<Lookup> {
  const head = `refs/heads/${branch}`;
  const listed = await git(["ls-remote", "--exit-code", "--heads", remote, head], root, FETCH_TIMEOUT_MS);
  if (listed.code === ABSENT_FROM_REMOTE) return { found: false, remote };
  if (listed.code !== 0) throw gitFailed(`git ls-remote ${remote} ${branch} failed: ${listed.stderr.trim()}`);
  const tracking = `refs/remotes/${remote}/${branch}`;
  await fetchInto(root, remote, `+${head}:${tracking}`, git);
  return found(tracking);
}

async function lookup(root: string, base: string, git: GitRunner): Promise<Lookup> {
  const remotes = await remotesOf(root, git);
  const { remote, branch } = splitRemote(base);
  if (remote !== null && remotes.includes(remote)) {
    await fetchInto(root, remote, branch, git);
    return found(base);
  }
  if (await hasLocalBranch(root, base, git)) return found(base);
  if (base === WORKTREE_DEFAULTS.baseRef) return found("HEAD");
  const fallbackRemote = defaultRemote(remotes);
  if (fallbackRemote === null) return { found: false, remote: null };
  return lookupOnRemote(root, fallbackRemote, base, git);
}

async function isAncestor(root: string, ref: string, of: string, git: GitRunner): Promise<boolean> {
  const res = await git(["merge-base", "--is-ancestor", ref, of], root);
  if (res.code > 1) throw gitFailed(`git merge-base ${ref} ${of} failed: ${res.stderr.trim()}`);
  return res.code === 0;
}

async function mergedFallback(
  root: string,
  base: string,
  remote: string,
  projectBase: string,
  git: GitRunner,
): Promise<BaseStart | null> {
  const stale = `refs/remotes/${remote}/${base}`;
  if (projectBase === base || !(await hasCommit(root, stale, git))) return null;
  const project = await lookup(root, projectBase, git);
  if (!project.found || !(await isAncestor(root, stale, project.start, git))) return null;
  return { start: project.start, fallback: { base, from: projectBase } };
}

export async function resolveBase(
  root: string,
  base: string,
  projectBase: string,
  git: GitRunner,
): Promise<BaseStart> {
  const first = await lookup(root, base, git);
  if (first.found) return { start: first.start, fallback: null };
  if (first.remote === null) throw gitFailed(`base branch ${base} not found locally`);
  const merged = await mergedFallback(root, base, first.remote, projectBase, git);
  if (merged === null) throw gitFailed(`base branch ${base} not found locally or on ${first.remote}`);
  return merged;
}
