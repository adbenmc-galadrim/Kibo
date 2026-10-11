import { afterEach, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupTmp, commit, git, repo, tmp } from "../agents/git-test-kit";
import { runGit } from "../agents/workspace-prep";
import { changedFiles, checkFiles } from "./file-check";

afterEach(cleanupTmp);

const write = (dir: string, path: string, content: string) => {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), content);
};

test("committed, modified and untracked files are changed; ignored files are not", async () => {
  const dir = await repo();
  write(dir, ".gitignore", "dist/\n");
  write(dir, "src/kept.ts", "a");
  write(dir, "src/edited.ts", "a");
  await git(["add", "."], dir);
  await git([...commit, "-m", "base"], dir);
  const base = await git(["rev-parse", "HEAD"], dir);
  write(dir, "src/committed.ts", "b");
  await git(["add", "."], dir);
  await git([...commit, "-m", "work"], dir);
  write(dir, "src/edited.ts", "b");
  write(dir, "src/new.ts", "c");
  write(dir, "src/é t.ts", "e");
  write(dir, "dist/out.js", "d");
  expect((await changedFiles(runGit, dir, base))?.sort()).toEqual([
    "src/committed.ts",
    "src/edited.ts",
    "src/new.ts",
    "src/é t.ts",
  ]);
});

test("paths stay relative to the repository from a sub-folder", async () => {
  const dir = await repo();
  const base = await git(["rev-parse", "HEAD"], dir);
  write(dir, "pkg/a.ts", "a");
  await git(["add", "."], dir);
  await git([...commit, "-m", "a"], dir);
  write(dir, "pkg/b.ts", "b");
  expect((await changedFiles(runGit, join(dir, "pkg"), base))?.sort()).toEqual(["pkg/a.ts", "pkg/b.ts"]);
});

test("a folder outside git or an unknown base gives null", async () => {
  expect(await changedFiles(runGit, tmp(), "HEAD")).toBeNull();
  const dir = await repo();
  expect(await changedFiles(runGit, dir, "0".repeat(40))).toBeNull();
});

test("declared and changed files are compared after normalisation", () => {
  expect(checkFiles(["src/a.ts", "./src/b.ts"], ["src/a.ts", "src/c.ts"])).toEqual({
    undeclared: ["src/c.ts"],
    unchanged: ["src/b.ts"],
  });
  expect(checkFiles(["src\\a.ts", "./src/a.ts"], ["src/a.ts"])).toEqual({ undeclared: [], unchanged: [] });
});

test("the check never grows past the schema bounds", () => {
  const many = Array.from({ length: 150 }, (_, i) => `f${i}.ts`);
  const check = checkFiles([], many);
  expect(check.undeclared).toHaveLength(100);
  expect(check.unchanged).toEqual([]);
});
