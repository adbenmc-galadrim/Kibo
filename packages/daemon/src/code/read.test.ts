import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  compare,
  currentOperation,
  headCommit,
  isPushed,
  MAX_DIFF_SIDE_BYTES,
  readDiff,
  readFile,
  readStatus,
  remoteBranches,
  sha1,
} from "./read";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
const lines = (n: number) => `${Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n")}\n`;

beforeEach(async () => {
  fx = createGitFixture();
  fx.commit("chore: init", { "src/ticket.ts": lines(40), "src/legacy.ts": "old\n", "README.md": "# kibo\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  h = await (await openRepo(fx.repo, fx.env)).open(fx.repo);
});
afterEach(() => fx.cleanup());

describe("openRepo", () => {
  test("a folder that is not a repository, or no folder, is refused", async () => {
    const plain = join(fx.dir, "plain");
    mkdirSync(plain);
    writeFileSync(join(fx.dir, "file.txt"), "x");
    await expect(openRepo(plain, fx.env)).rejects.toMatchObject({ code: "NOT_A_REPO" });
    await expect(openRepo(null, fx.env)).rejects.toMatchObject({ code: "NOT_A_REPO" });
    await expect(openRepo(join(fx.dir, "missing"), fx.env)).rejects.toMatchObject({ code: "NOT_A_REPO" });
    await expect(openRepo(join(fx.dir, "file.txt"), fx.env)).rejects.toMatchObject({ code: "NOT_A_REPO" });
  });

  test("only registered worktrees can be opened", async () => {
    const wt = join(fx.dir, "wt-kib-12");
    fx.git("worktree", "add", "-q", "-b", "kib-12", wt);
    const repo = await openRepo(join(fx.repo, "src"), fx.env);
    expect(repo.root).toBe(fx.repo);
    expect((await repo.worktrees()).map((w) => [w.path, w.branch, w.isMain])).toEqual([
      [fx.repo, "main", true],
      [wt, "kib-12", false],
    ]);
    const handle = await repo.open(wt);
    expect(handle.gitDir).toBe(join(fx.repo, ".git/worktrees/wt-kib-12"));
    expect(handle.commonDir).toBe(join(fx.repo, ".git"));
    await expect(repo.open(fx.dir)).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
    await expect(repo.open(join(fx.repo, "src"))).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
    await expect(repo.open(join(fx.dir, "missing"))).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });
});

describe("readStatus", () => {
  test("files are listed per area with line counts", async () => {
    fx.write("src/ticket.ts", lines(40).replace("line 1\n", "LINE 1\nnew\n"));
    fx.git("add", "src/ticket.ts");
    fx.write("README.md", "# kibo\nmore\n");
    fx.write("src/tree.ts", "a\nb\nc\n");
    rmSync(join(fx.repo, "src/legacy.ts"));
    const s = await readStatus(h);
    expect(s).toMatchObject({
      branch: "main",
      upstream: "origin/main",
      ahead: 0,
      behind: 0,
      hasHead: true,
      operation: null,
    });
    expect(s.files).toEqual([
      { path: "README.md", origPath: null, area: "unstaged", kind: "modified", additions: 1, deletions: 0 },
      {
        path: "src/legacy.ts",
        origPath: null,
        area: "unstaged",
        kind: "deleted",
        additions: 0,
        deletions: 1,
      },
      { path: "src/ticket.ts", origPath: null, area: "staged", kind: "modified", additions: 2, deletions: 1 },
      {
        path: "src/tree.ts",
        origPath: null,
        area: "unstaged",
        kind: "untracked",
        additions: 3,
        deletions: 0,
      },
    ]);
  });

  test("an untracked symbolic link is never followed to count lines", async () => {
    writeFileSync(join(fx.dir, "secret.txt"), "a\nb\n");
    symlinkSync(join(fx.dir, "secret.txt"), join(fx.repo, "link.txt"));
    expect((await readStatus(h)).files).toContainEqual({
      path: "link.txt",
      origPath: null,
      area: "unstaged",
      kind: "untracked",
      additions: null,
      deletions: null,
    });
  });

  test("unpushed commits come first, then the last pushed one", async () => {
    const pushedHead = fx.git("rev-parse", "HEAD").trim();
    fx.commit("feat: opérations move", { "src/a.ts": "a\n" });
    const unpushed = fx.commit("test: convergence", { "src/b.ts": "b\n" });
    const s = await readStatus(h);
    expect(s.ahead).toBe(2);
    expect(s.commits.map((c) => [c.subject, c.pushed])).toEqual([
      ["test: convergence", false],
      ["feat: opérations move", false],
      ["chore: init", true],
    ]);
    expect(s.commits[2]?.sha).toBe(pushedHead);
    expect(await isPushed(h, pushedHead)).toBe(true);
    expect(await isPushed(h, unpushed)).toBe(false);
    expect((await headCommit(h)).subject).toBe("test: convergence");
    await expect(isPushed(h, "--all")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("an empty repository has no head and no commits", async () => {
    const empty = createGitFixture({ remote: false });
    try {
      empty.write("a.txt", "a\n");
      const eh = await (await openRepo(empty.repo, empty.env)).open(empty.repo);
      expect(await readStatus(eh)).toMatchObject({ hasHead: false, commits: [], ahead: 0, branch: "main" });
      expect((await readFile(eh, "a.txt", "head")).content).toBe("");
      await expect(headCommit(eh)).rejects.toMatchObject({ code: "GIT_FAILED" });
    } finally {
      empty.cleanup();
    }
  });

  test("a merge conflict is reported as an operation with conflicted files", async () => {
    fx.git("checkout", "-q", "-b", "other");
    fx.commit("other", { "README.md": "# other\n" });
    fx.git("checkout", "-q", "main");
    fx.commit("main", { "README.md": "# main\n" });
    Bun.spawnSync(["git", "merge", "other"], { cwd: fx.repo, env: { ...process.env, ...fx.env } });
    expect(await currentOperation(h)).toBe("merge");
    expect((await readStatus(h)).files).toContainEqual({
      path: "README.md",
      origPath: null,
      area: "unstaged",
      kind: "conflicted",
      additions: null,
      deletions: null,
    });
  });
});

describe("readDiff", () => {
  test("staged, unstaged and untracked diffs", async () => {
    fx.write("src/ticket.ts", lines(40).replace("line 2\n", "LINE 2\n"));
    fx.git("add", "src/ticket.ts");
    fx.write("src/ticket.ts", lines(40).replace("line 2\n", "LINE 2\n").replace("line 39\n", "LINE 39\n"));
    fx.write("src/tree.ts", "a\nb\n");
    const staged = await readDiff(h, "src/ticket.ts", null, "staged");
    expect(staged.hunks.map((x) => x.header)).toEqual(["@@ -1,5 +1,5 @@"]);
    const unstaged = await readDiff(h, "src/ticket.ts", null, "unstaged");
    expect(unstaged).toMatchObject({ hunkStaging: true, additions: 1, deletions: 1 });
    expect(unstaged.hunks[0]?.header).toBe("@@ -36,5 +36,5 @@ line 35");
    const untracked = await readDiff(h, "src/tree.ts", null, "unstaged");
    expect(untracked).toMatchObject({ hunkStaging: false, additions: 2 });
  });

  test("a staged rename carries both paths", async () => {
    fx.git("mv", "src/legacy.ts", "src/renamed.ts");
    const diff = await readDiff(h, "src/renamed.ts", "src/legacy.ts", "staged");
    expect(diff).toMatchObject({ path: "src/renamed.ts", origPath: "src/legacy.ts", hunkStaging: false });
  });

  test("paths are literal, never pathspec patterns", async () => {
    fx.write("README.md", "# kibo\nchanged\n");
    fx.write("src/ticket.ts", `${lines(40)}more\n`);
    fx.git("add", "README.md", "src/ticket.ts");
    expect((await readDiff(h, "*", null, "staged")).hunks).toEqual([]);
    await expect(readDiff(h, "*", null, "unstaged")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await readFile(h, "*", "index")).toMatchObject({ content: "", tracked: false, dirty: false });
  });

  test("paths outside the worktree are refused", async () => {
    await expect(readDiff(h, "../x", null, "unstaged")).rejects.toMatchObject({
      code: "PATH_OUTSIDE_PROJECT",
    });
    await expect(readDiff(h, "a", "../x", "staged")).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
  });

  test("a file too large to diff is refused before running git", async () => {
    writeFileSync(join(fx.repo, "huge.txt"), "x".repeat(MAX_DIFF_SIDE_BYTES + 1));
    await expect(readDiff(h, "huge.txt", null, "unstaged")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    fx.git("add", "huge.txt");
    await expect(readDiff(h, "huge.txt", null, "staged")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("readFile", () => {
  test("worktree, index and HEAD revisions with metadata", async () => {
    fx.write("README.md", "# kibo\nstaged\n");
    fx.git("add", "README.md");
    fx.write("README.md", "# kibo\nstaged\nworktree\n");
    const w = await readFile(h, "README.md", "worktree");
    expect(w).toMatchObject({
      content: "# kibo\nstaged\nworktree\n",
      lines: 3,
      tracked: true,
      dirty: true,
      binary: false,
    });
    expect(w.hash).toBe(sha1(new TextEncoder().encode("# kibo\nstaged\nworktree\n")));
    expect(w.modifiedAt).toBeGreaterThan(0);
    expect((await readFile(h, "README.md", "index")).content).toBe("# kibo\nstaged\n");
    expect(await readFile(h, "README.md", "head")).toMatchObject({ content: "# kibo\n", modifiedAt: null });
    expect(await readFile(h, "src/legacy.ts", "worktree")).toMatchObject({ tracked: true, dirty: false });
  });

  test("binary, too large, missing and forbidden files", async () => {
    writeFileSync(join(fx.repo, "logo.png"), new Uint8Array([137, 80, 78, 71, 0, 1, 2]));
    expect(await readFile(h, "logo.png", "worktree")).toMatchObject({
      binary: true,
      content: null,
      tracked: false,
    });
    writeFileSync(join(fx.repo, "big.txt"), "x".repeat(1_000_001));
    expect(await readFile(h, "big.txt", "worktree")).toMatchObject({
      tooLarge: true,
      content: null,
      hash: null,
    });
    fx.git("add", "big.txt");
    expect(await readFile(h, "big.txt", "index")).toMatchObject({
      tooLarge: true,
      content: null,
      size: 1_000_001,
    });
    expect((await readFile(h, "new.ts", "head")).content).toBe("");
    await expect(readFile(h, "missing.ts", "worktree")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readFile(h, "src", "worktree")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readFile(h, ".git/config", "worktree")).rejects.toMatchObject({
      code: "PATH_OUTSIDE_PROJECT",
    });
  });
});

test("remote branches and comparison with a base", async () => {
  fx.git("checkout", "-q", "-b", "kib-12");
  fx.commit("feat: a", { "src/a.ts": "a\n" });
  fx.commit("feat: b", { "src/b.ts": "b\n", "src/a.ts": "a2\n" });
  expect(await remoteBranches(h)).toEqual({ remote: "origin", branches: ["main"], defaultBase: "main" });
  const c = await compare(h, "main");
  expect(c.commits.map((x) => x.subject)).toEqual(["feat: b", "feat: a"]);
  expect(c.fileCount).toBe(2);
  await expect(compare(h, "--output=/tmp/x")).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("without a remote there are no remote branches", async () => {
  const local = createGitFixture({ remote: false });
  try {
    local.commit("chore: init", { "a.txt": "a\n" });
    const lh = await (await openRepo(local.repo, local.env)).open(local.repo);
    expect(await remoteBranches(lh)).toEqual({ remote: null, branches: [], defaultBase: null });
    await expect(compare(lh, "main")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  } finally {
    local.cleanup();
  }
});
