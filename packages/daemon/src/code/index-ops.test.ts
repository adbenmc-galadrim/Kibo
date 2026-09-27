import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, existsSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  discardChanges,
  stageAll,
  stageFiles,
  stageHunk,
  unstageAll,
  unstageFiles,
  writeFile,
} from "./index-ops";
import { MAX_FILE_BYTES, readDiff, readFile, readStatus } from "./read";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
const lines = (n: number) => `${Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n")}\n`;

beforeEach(async () => {
  fx = createGitFixture({ remote: false });
  fx.commit("chore: init", { "src/ticket.ts": lines(40), "src/legacy.ts": "old\n" });
  h = await (await openRepo(fx.repo, fx.env)).open(fx.repo);
});
afterEach(() => fx.cleanup());

const areas = async () => (await readStatus(h)).files.map((f) => `${f.area}:${f.kind}:${f.path}`);

test("files are staged and unstaged, including deletions and new files", async () => {
  fx.write("src/new.ts", "n\n");
  fx.write("src/ticket.ts", `${lines(40)}more\n`);
  rmSync(join(fx.repo, "src/legacy.ts"));
  await stageFiles(h, ["src/new.ts", "src/ticket.ts", "src/legacy.ts"]);
  expect(await areas()).toEqual([
    "staged:deleted:src/legacy.ts",
    "staged:added:src/new.ts",
    "staged:modified:src/ticket.ts",
  ]);
  await unstageFiles(h, ["src/new.ts", "src/legacy.ts"]);
  expect(await areas()).toEqual([
    "unstaged:deleted:src/legacy.ts",
    "unstaged:untracked:src/new.ts",
    "staged:modified:src/ticket.ts",
  ]);
});

test("unstaging works before the first commit", async () => {
  const empty = createGitFixture({ remote: false });
  try {
    empty.write("a.txt", "a\n");
    const eh = await (await openRepo(empty.repo, empty.env)).open(empty.repo);
    await stageFiles(eh, ["a.txt"]);
    await unstageFiles(eh, ["a.txt"]);
    expect((await readStatus(eh)).files.map((f) => f.area)).toEqual(["unstaged"]);
  } finally {
    empty.cleanup();
  }
});

test("a single hunk is staged, then unstaged, the other stays untouched", async () => {
  fx.write("src/ticket.ts", lines(40).replace("line 2\n", "LINE 2\n").replace("line 39\n", "LINE 39\n"));
  const before = await readDiff(h, "src/ticket.ts", null, "unstaged");
  expect(before.hunks).toHaveLength(2);
  const second = before.hunks[1];
  if (!second) throw new Error("second hunk expected");
  await stageHunk(h, { path: "src/ticket.ts", area: "unstaged", index: 1, header: second.header });
  expect(fx.git("diff", "--cached", "--", "src/ticket.ts")).toContain("+LINE 39");
  expect(fx.git("diff", "--cached", "--", "src/ticket.ts")).not.toContain("LINE 2");
  expect(fx.git("diff", "--", "src/ticket.ts")).toContain("+LINE 2");
  const staged = await readDiff(h, "src/ticket.ts", null, "staged");
  await stageHunk(h, {
    path: "src/ticket.ts",
    area: "staged",
    index: 0,
    header: staged.hunks[0]?.header ?? "",
  });
  expect(fx.git("diff", "--cached")).toBe("");
});

test("a hunk whose header changed on disk is refused and the index is untouched", async () => {
  fx.write("src/ticket.ts", lines(40).replace("line 39\n", "LINE 39\n"));
  const seen = await readDiff(h, "src/ticket.ts", null, "unstaged");
  fx.write("src/ticket.ts", `top\n${lines(40).replace("line 39\n", "LINE 39\n")}`);
  await expect(
    stageHunk(h, { path: "src/ticket.ts", area: "unstaged", index: 0, header: seen.hunks[0]?.header ?? "" }),
  ).rejects.toMatchObject({ code: "GIT_STALE" });
  await expect(
    stageHunk(h, { path: "src/ticket.ts", area: "unstaged", index: 5, header: "@@ -1 +1 @@" }),
  ).rejects.toMatchObject({ code: "GIT_STALE" });
  expect(fx.git("diff", "--cached")).toBe("");
});

test("whole-file-only diffs refuse hunk staging", async () => {
  fx.write("src/new.ts", "n\n");
  await expect(
    stageHunk(h, { path: "src/new.ts", area: "unstaged", index: 0, header: "@@ -0,0 +1 @@" }),
  ).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
});

test("writeFile replaces atomically, keeps the mode and returns the new hash", async () => {
  chmodSync(join(fx.repo, "src/ticket.ts"), 0o775);
  const read = await readFile(h, "src/ticket.ts", "worktree");
  const res = await writeFile(h, "src/ticket.ts", "edited\n", read.hash ?? "");
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe("edited\n");
  expect(statSync(join(fx.repo, "src/ticket.ts")).mode & 0o777).toBe(0o775);
  expect(res.hash).toBe((await readFile(h, "src/ticket.ts", "worktree")).hash ?? "");
  expect(fx.git("status", "--porcelain", "--untracked-files=all")).toBe(" M src/ticket.ts\n");
});

test("an edit based on an outdated read is refused and the agent's version stays on disk", async () => {
  const read = await readFile(h, "src/ticket.ts", "worktree");
  writeFileSync(join(fx.repo, "src/ticket.ts"), "written by the agent\n");
  await expect(writeFile(h, "src/ticket.ts", "written by the user\n", read.hash ?? "")).rejects.toMatchObject(
    {
      code: "FILE_CHANGED",
    },
  );
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe("written by the agent\n");
});

test("symlinks, missing files and paths outside the worktree are refused", async () => {
  symlinkSync(join(fx.repo, "src/ticket.ts"), join(fx.repo, "link.ts"));
  await expect(writeFile(h, "link.ts", "x", "0".repeat(40))).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  await expect(writeFile(h, "src/missing.ts", "x", "0".repeat(40))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(writeFile(h, "../escape.ts", "x", "0".repeat(40))).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  await expect(stageFiles(h, ["../escape.ts"])).rejects.toMatchObject({ code: "PATH_OUTSIDE_PROJECT" });
});

test("unstaging a staged rename unstages both sides", async () => {
  fx.git("mv", "src/legacy.ts", "src/renamed.ts");
  await unstageFiles(h, ["src/renamed.ts"]);
  expect(await areas()).toEqual(["unstaged:deleted:src/legacy.ts", "unstaged:untracked:src/renamed.ts"]);
});

test("writeFile refuses content above the size limit and directories", async () => {
  const read = await readFile(h, "src/ticket.ts", "worktree");
  await expect(
    writeFile(h, "src/ticket.ts", "x".repeat(MAX_FILE_BYTES + 1), read.hash ?? ""),
  ).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(writeFile(h, "src", "x", "0".repeat(40))).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(fx.git("status", "--porcelain", "--untracked-files=all")).toBe("");
});

test("discarding restores a modified, a deleted and a staged file to HEAD", async () => {
  fx.write("src/ticket.ts", `${lines(40)}more\n`);
  rmSync(join(fx.repo, "src/legacy.ts"));
  fx.write("src/staged.ts", "s\n");
  await stageFiles(h, ["src/staged.ts"]);
  await discardChanges(h, ["src/ticket.ts", "src/legacy.ts", "src/staged.ts"]);
  expect(await areas()).toEqual([]);
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe(lines(40));
  expect(readFileSync(join(fx.repo, "src/legacy.ts"), "utf8")).toBe("old\n");
  expect(existsSync(join(fx.repo, "src/staged.ts"))).toBe(false);
});

test("discarding an untracked file deletes it and leaves the others alone", async () => {
  fx.write("src/new.ts", "n\n");
  fx.write("src/keep.ts", "k\n");
  await discardChanges(h, ["src/new.ts"]);
  expect(existsSync(join(fx.repo, "src/new.ts"))).toBe(false);
  expect(await areas()).toEqual(["unstaged:untracked:src/keep.ts"]);
});

test("discarding untracked files inside a new folder deletes only them", async () => {
  fx.write("docs/deep/a.md", "a\n");
  fx.write("docs/b.md", "b\n");
  fx.write("docs/deep/keep.md", "k\n");
  await discardChanges(h, ["docs/deep/a.md", "docs/b.md"]);
  expect(existsSync(join(fx.repo, "docs/deep/a.md"))).toBe(false);
  expect(existsSync(join(fx.repo, "docs/b.md"))).toBe(false);
  expect(await areas()).toEqual(["unstaged:untracked:docs/deep/keep.md"]);
});

test("discarding a staged rename restores the source and removes the target", async () => {
  fx.git("mv", "src/legacy.ts", "src/renamed.ts");
  expect(await areas()).toEqual(["staged:renamed:src/renamed.ts"]);
  await discardChanges(h, ["src/renamed.ts", "src/legacy.ts"]);
  expect(await areas()).toEqual([]);
  expect(existsSync(join(fx.repo, "src/renamed.ts"))).toBe(false);
  expect(readFileSync(join(fx.repo, "src/legacy.ts"), "utf8")).toBe("old\n");
});

test("discarding refuses paths outside the worktree before touching anything", async () => {
  fx.write("src/new.ts", "n\n");
  await expect(discardChanges(h, ["src/new.ts", "../outside.ts"])).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  await expect(discardChanges(h, ["src/new.ts", ".git/config"])).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  writeFileSync(join(fx.dir, "outside.ts"), "o\n");
  symlinkSync(fx.dir, join(fx.repo, "escape"));
  await expect(discardChanges(h, ["src/new.ts", "escape/outside.ts"])).rejects.toMatchObject({
    code: "PATH_OUTSIDE_PROJECT",
  });
  expect(existsSync(join(fx.repo, "src/new.ts"))).toBe(true);
  expect(readFileSync(join(fx.dir, "outside.ts"), "utf8")).toBe("o\n");
});

test("discarding an untracked symlink removes the link, never its target", async () => {
  symlinkSync(join(fx.repo, "src/ticket.ts"), join(fx.repo, "link.ts"));
  await discardChanges(h, ["link.ts"]);
  expect(existsSync(join(fx.repo, "link.ts"))).toBe(false);
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe(lines(40));
});

const conflictOnLegacy = () => {
  fx.git("checkout", "-q", "-b", "other");
  fx.commit("feat: other", { "src/legacy.ts": "theirs\n" });
  fx.git("checkout", "-q", "main");
  fx.commit("feat: main", { "src/legacy.ts": "ours\n" });
  const merge = Bun.spawnSync(["git", "merge", "other"], {
    cwd: fx.repo,
    env: { ...process.env, ...fx.env },
  });
  expect(merge.exitCode).not.toBe(0);
};

test("discarding refuses during an operation and on a conflicted file", async () => {
  conflictOnLegacy();
  await expect(discardChanges(h, ["src/legacy.ts"])).rejects.toMatchObject({ code: "GIT_BUSY" });
  expect(readFileSync(join(fx.repo, "src/legacy.ts"), "utf8")).toContain("<<<<<<<");
});

test("discarding a conflicted file left without an operation is refused", async () => {
  conflictOnLegacy();
  rmSync(join(fx.repo, ".git/MERGE_HEAD"));
  await expect(discardChanges(h, ["src/legacy.ts"])).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(readFileSync(join(fx.repo, "src/legacy.ts"), "utf8")).toContain("<<<<<<<");
});

test("stageAll indexes every change and unstageAll empties the index without touching files", async () => {
  fx.write("src/new.ts", "n\n");
  fx.write("src/ticket.ts", `${lines(40)}more\n`);
  rmSync(join(fx.repo, "src/legacy.ts"));
  await stageAll(h);
  expect(await areas()).toEqual([
    "staged:deleted:src/legacy.ts",
    "staged:added:src/new.ts",
    "staged:modified:src/ticket.ts",
  ]);
  await unstageAll(h);
  expect(await areas()).toEqual([
    "unstaged:deleted:src/legacy.ts",
    "unstaged:untracked:src/new.ts",
    "unstaged:modified:src/ticket.ts",
  ]);
  expect(readFileSync(join(fx.repo, "src/ticket.ts"), "utf8")).toBe(`${lines(40)}more\n`);
});

test("unstageAll works before the first commit", async () => {
  const empty = createGitFixture({ remote: false });
  try {
    empty.write("a.txt", "a\n");
    const eh = await (await openRepo(empty.repo, empty.env)).open(empty.repo);
    await stageAll(eh);
    await unstageAll(eh);
    expect((await readStatus(eh)).files.map((f) => f.area)).toEqual(["unstaged"]);
  } finally {
    empty.cleanup();
  }
});
