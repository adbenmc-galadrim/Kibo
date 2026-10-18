import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inScope, scopeOf, trackedFiles } from "./tracked-files";

function git(cwd: string, ...args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

test("scopeOf splits comma-separated prefixes", () => {
  expect(scopeOf("packages/daemon, e2e")).toEqual(["packages/daemon", "e2e"]);
  expect(scopeOf("e2e/,")).toEqual(["e2e"]);
});

test("scopeOf is empty when unset", () => {
  expect(scopeOf(undefined)).toEqual([]);
  expect(scopeOf("  ")).toEqual([]);
});

test("inScope matches directories and exact files", () => {
  expect(inScope("e2e/serve.ts", [])).toBe(true);
  expect(inScope("e2e/serve.ts", ["e2e"])).toBe(true);
  expect(inScope("e2e-old/serve.ts", ["e2e"])).toBe(false);
  expect(inScope("docs/plan.md", ["docs/plan.md"])).toBe(true);
});

test("trackedFiles lists tracked paths only", () => {
  const root = mkdtempSync(join(tmpdir(), "kibo-tracked-"));
  git(root, "init", "-q");
  mkdirSync(join(root, "dir"));
  writeFileSync(join(root, "dir", "a b.txt"), "a");
  writeFileSync(join(root, "untracked.txt"), "b");
  git(root, "add", "dir");
  expect(trackedFiles(root)).toEqual(["dir/a b.txt"]);
});
