import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupTmp, commit, git, merge, repo, worktree } from "./git-test-kit";

afterEach(cleanupTmp);

async function addOn(dir: string, file: string, content: string): Promise<void> {
  writeFileSync(join(dir, file), content);
  await git(["add", file], dir);
  await git([...commit, "-m", `add ${file}`], dir);
}

describe("git test kit worktrees", () => {
  test("worktree creates a new branch from HEAD in its own folder", async () => {
    const r = await repo();
    const wt = await worktree(r, "feat-a");
    expect(existsSync(wt)).toBe(true);
    expect(wt).toBe(realpathSync(wt));
    expect(await git(["rev-parse", "--abbrev-ref", "HEAD"], wt)).toBe("feat-a");
    expect(await git(["rev-parse", "HEAD"], wt)).toBe(await git(["rev-parse", "HEAD"], r));
  });

  test("merging the same file added identically on two branches has no conflict", async () => {
    const r = await repo();
    const a = await worktree(r, "feat-a");
    const b = await worktree(r, "feat-b");
    await addOn(a, "f.ts", "export const formatDate = 1;\n");
    await addOn(b, "f.ts", "export const formatDate = 1;\n");
    expect((await merge(r, "feat-a")).code).toBe(0);
    expect((await merge(r, "feat-b")).code).toBe(0);
  });

  test("merging the same file added differently conflicts", async () => {
    const r = await repo();
    const a = await worktree(r, "feat-a");
    const b = await worktree(r, "feat-b");
    await addOn(a, "f.ts", "export const formatDate = 1;\n");
    await addOn(b, "f.ts", "export const formatDate = 2;\n");
    expect((await merge(r, "feat-a")).code).toBe(0);
    const res = await merge(r, "feat-b");
    expect(res.code).not.toBe(0);
    expect(res.stdout).toContain("CONFLICT");
  });
});
