import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import { cleanupTmp, git, repo, tmp, worktree } from "../agents/git-test-kit";
import { readBranches } from "./refs-reader";

afterEach(cleanupTmp);

const collect = () => {
  const seen: string[] = [];
  return { seen, log: (what: string) => () => void seen.push(what) };
};

test("local branches, worktree branches and remote-tracking branches, deduplicated", async () => {
  const dir = await repo();
  await worktree(dir, "feat/emis-33-envoi-hors-ligne");
  await git(["update-ref", "refs/remotes/origin/feat/x", "HEAD"], dir);
  await git(["update-ref", "refs/remotes/origin/main", "HEAD"], dir);
  await git(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], dir);
  const { seen, log } = collect();
  expect(await readBranches(dir, {}, log)).toEqual(["feat/emis-33-envoi-hors-ligne", "feat/x", "main"]);
  expect(seen).toEqual([]);
});

test("a branch created in a worktree is read from the project folder", async () => {
  const dir = await repo();
  const wt = await worktree(dir, "feat/a");
  await git(["switch", "-q", "-c", "feat/emis-1-b"], wt);
  expect(await readBranches(dir, {}, collect().log)).toEqual(["feat/a", "feat/emis-1-b", "main"]);
});

test("a folder without a repository reads no branch and is logged", async () => {
  const { seen, log } = collect();
  expect(await readBranches(tmp(), {}, log)).toEqual([]);
  expect(await readBranches(join(tmp(), "missing"), {}, log)).toEqual([]);
  expect(seen).toHaveLength(2);
});
