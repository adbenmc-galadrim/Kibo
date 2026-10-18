import { afterEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { type GitBranchRef, WORKTREE_DEFAULTS } from "@kibo/schema";
import { cleanupTmp, git, repo, tmp } from "./git-test-kit";
import { runGit } from "./workspace-prep";
import { prepareWorktree, runShell, type WorktreeInput } from "./worktree-prep";

afterEach(cleanupTmp);

const ref = (branch: string): GitBranchRef => ({ kind: "git_branch", branch, base: null });
const input = (root: string, patch: Partial<WorktreeInput> = {}): WorktreeInput => ({
  root,
  ticketKey: "SILO-22",
  branchRef: ref("feat/perimetre"),
  settings: WORKTREE_DEFAULTS,
  runDir: join(tmp(), "run"),
  git: runGit,
  shell: runShell,
  ...patch,
});

test("a worktree folder deleted by hand while git still lists it is recreated", async () => {
  for (const setup of [null, "git worktree add {path} {branch}"]) {
    const root = await repo();
    const settings = { ...WORKTREE_DEFAULTS, setup };
    const first = await prepareWorktree(input(root, { settings }));
    rmSync(first.cwd, { recursive: true, force: true });
    const second = await prepareWorktree(input(root, { settings }));
    expect(second.cwd).toBe(first.cwd);
    expect(await git(["rev-parse", "--abbrev-ref", "HEAD"], second.cwd)).toBe("feat/perimetre");
  }
});

test("a deleted worktree of another branch is left registered", async () => {
  const root = await repo();
  const other = join(tmp(), "other");
  await git(["worktree", "add", "-q", "-b", "feat/autre", other], root);
  rmSync(other, { recursive: true, force: true });
  await prepareWorktree(input(root));
  expect(await git(["worktree", "list", "--porcelain"], root)).toContain(other);
});

test("a tag named like the branch does not make the worktree look on the wrong branch", async () => {
  const root = await repo();
  await git(["tag", "feat/perimetre"], root);
  const ws = await prepareWorktree(input(root));
  expect(ws.label).toBe("worktree:feat/perimetre");
});
