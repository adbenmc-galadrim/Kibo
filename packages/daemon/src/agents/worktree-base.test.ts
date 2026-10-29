import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import { type BaseFallback, type GitBranchRef, WORKTREE_DEFAULTS, type WorktreeSettings } from "@kibo/schema";
import { runGit } from "../runs/workspace-prep";
import { cleanupTmp, commit, git, repo, tmp } from "../testing/git-test-kit";
import { prepareWorktree, runShell, type WorktreeInput } from "./worktree-prep";

afterEach(cleanupTmp);

const DEV = { ...WORKTREE_DEFAULTS, baseRef: "origin/dev" } satisfies WorktreeSettings;
const child = (base: string): GitBranchRef => ({ kind: "git_branch", branch: "feat/child", base });
const input = (root: string, base: string, patch: Partial<WorktreeInput> = {}): WorktreeInput => ({
  root,
  ticketKey: "SILO-22",
  branchRef: child(base),
  settings: DEV,
  runDir: join(tmp(), "run"),
  git: runGit,
  shell: runShell,
  ...patch,
});

async function upstreamWithParent(): Promise<{ upstream: string; parentSha: string }> {
  const upstream = await repo("main");
  await git(["checkout", "-q", "-b", "dev"], upstream);
  await git(["checkout", "-q", "-b", "feat/matrice-droits"], upstream);
  await git([...commit, "--allow-empty", "-m", "parent"], upstream);
  const parentSha = await git(["rev-parse", "HEAD"], upstream);
  await git(["checkout", "-q", "main"], upstream);
  return { upstream, parentSha };
}

async function clone(upstream: string): Promise<string> {
  const root = join(tmp(), "clone");
  await git(["clone", "-q", upstream, root], tmp());
  return root;
}

const headOf = (cwd: string) => git(["rev-parse", "HEAD"], cwd);

test("a slash base that only exists on origin is fetched and the branch starts from it", async () => {
  const { upstream, parentSha } = await upstreamWithParent();
  const root = await repo("main");
  await git(["remote", "add", "origin", upstream], root);
  const ws = await prepareWorktree(input(root, "feat/matrice-droits"));
  expect(await headOf(ws.cwd)).toBe(parentSha);
});

test("the only remote is used when it is not named origin", async () => {
  const { upstream, parentSha } = await upstreamWithParent();
  const root = await repo("main");
  await git(["remote", "add", "upstream", upstream], root);
  const ws = await prepareWorktree(input(root, "feat/matrice-droits", { settings: WORKTREE_DEFAULTS }));
  expect(await headOf(ws.cwd)).toBe(parentSha);
});

test("a local base wins over the remote one", async () => {
  const { upstream } = await upstreamWithParent();
  const root = await repo("main");
  await git(["remote", "add", "origin", upstream], root);
  await git(["branch", "feat/matrice-droits"], root);
  const ws = await prepareWorktree(input(root, "feat/matrice-droits"));
  expect(await headOf(ws.cwd)).toBe(await headOf(root));
});

test("a base merged then deleted falls back to the project base and says so", async () => {
  const { upstream } = await upstreamWithParent();
  await git(["checkout", "-q", "dev"], upstream);
  await git([...commit.slice(0, 6), "merge", "-q", "--no-ff", "--no-edit", "feat/matrice-droits"], upstream);
  const root = await clone(upstream);
  await git(["branch", "-D", "feat/matrice-droits"], upstream);
  await git([...commit, "--allow-empty", "-m", "after merge"], upstream);
  const devSha = await headOf(upstream);
  await git(["checkout", "-q", "main"], upstream);
  const fallbacks: BaseFallback[] = [];
  const ws = await prepareWorktree(
    input(root, "feat/matrice-droits", { onBaseFallback: (f) => fallbacks.push(f) }),
  );
  expect(await headOf(ws.cwd)).toBe(devSha);
  expect(fallbacks).toEqual([{ base: "feat/matrice-droits", from: "origin/dev" }]);
});

test("a deleted base that was never merged is an error, not a silent fallback", async () => {
  const { upstream } = await upstreamWithParent();
  const root = await clone(upstream);
  await git(["branch", "-D", "feat/matrice-droits"], upstream);
  const fallbacks: BaseFallback[] = [];
  await expect(
    prepareWorktree(input(root, "feat/matrice-droits", { onBaseFallback: (f) => fallbacks.push(f) })),
  ).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: "base branch feat/matrice-droits not found locally or on origin",
  });
  expect(fallbacks).toEqual([]);
  expect(await git(["branch", "--list", "feat/child"], root)).toBe("");
});

test("a base found nowhere, without a stale trace, is a clear error", async () => {
  const { upstream } = await upstreamWithParent();
  const root = await repo("main");
  await git(["remote", "add", "origin", upstream], root);
  await expect(prepareWorktree(input(root, "feat/nowhere"))).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: "base branch feat/nowhere not found locally or on origin",
  });
  const lone = await repo("main");
  await expect(prepareWorktree(input(lone, "feat/nowhere"))).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: "base branch feat/nowhere not found locally",
  });
});
