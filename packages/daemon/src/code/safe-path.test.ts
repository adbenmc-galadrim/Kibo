import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertNotSymlink, isInside, resolveInWorktree } from "./safe-path";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
beforeEach(() => {
  fx = createGitFixture({ remote: false });
  fx.write("src/a.ts", "a\n");
});
afterEach(() => fx.cleanup());

const outsideProject = expect.objectContaining({ code: "PATH_OUTSIDE_PROJECT" });

test("isInside compares path segments, not prefixes", () => {
  expect(isInside("/a/repo", "/a/repo/x")).toBe(true);
  expect(isInside("/a/repo", "/a/repo")).toBe(true);
  expect(isInside("/a/repo", "/a/repo-evil/x")).toBe(false);
  expect(isInside("/a/repo", "/a")).toBe(false);
  expect(isInside("/a/repo", "/a/repo/..x")).toBe(true);
});

test("relative paths inside the worktree resolve, including new nested ones", () => {
  expect(resolveInWorktree(fx.repo, "src/a.ts")).toBe(join(fx.repo, "src/a.ts"));
  expect(resolveInWorktree(fx.repo, "src/new/b.ts")).toBe(join(fx.repo, "src/new/b.ts"));
});

test("traversal, absolute paths, empty paths and .git are refused", () => {
  for (const p of [
    "../x",
    "src/../../x",
    "/etc/passwd",
    ".git/config",
    ".GIT/HEAD",
    "sub/.git/config",
    "a\0b",
    "",
  ]) {
    expect(() => resolveInWorktree(fx.repo, p)).toThrow(outsideProject);
  }
});

test("a symlink leading outside is refused, one staying inside is allowed", () => {
  const outside = join(fx.dir, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "secret"), "s");
  symlinkSync(outside, join(fx.repo, "escape"));
  symlinkSync(join(fx.repo, "src"), join(fx.repo, "alias"));
  expect(() => resolveInWorktree(fx.repo, "escape/secret")).toThrow(outsideProject);
  expect(() => resolveInWorktree(fx.repo, "escape/new/file")).toThrow(outsideProject);
  expect(resolveInWorktree(fx.repo, "alias/a.ts")).toBe(join(fx.repo, "alias/a.ts"));
  expect(() => assertNotSymlink(join(fx.repo, "alias"))).toThrow(outsideProject);
  expect(() => assertNotSymlink(join(fx.repo, "src/a.ts"))).not.toThrow();
  expect(() => assertNotSymlink(join(fx.repo, "src/missing.ts"))).not.toThrow();
});

test("a dangling symlink cannot be used to create a file outside", () => {
  symlinkSync(join(fx.dir, "outside-file"), join(fx.repo, "dangling"));
  expect(() => resolveInWorktree(fx.repo, "dangling")).toThrow(outsideProject);
  expect(() => resolveInWorktree(fx.repo, "dangling/x")).toThrow(outsideProject);
  expect(() => assertNotSymlink(join(fx.repo, "dangling"))).toThrow(outsideProject);
});
