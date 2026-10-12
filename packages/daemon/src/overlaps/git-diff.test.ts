import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { cleanupTmp, commit, git, repo } from "../agents/git-test-kit";
import { type GitRunner, runGit } from "../agents/workspace-prep";
import { addedLinesOf, gitDiffSummary } from "./git-diff";

afterEach(cleanupTmp);

async function based(): Promise<{ dir: string; base: string }> {
  const dir = await repo();
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/keep.ts"), "a\nb\nc\nd\n");
  writeFileSync(join(dir, "src/gone.ts"), "x\n");
  writeFileSync(join(dir, "src/old.ts"), "one\ntwo\nthree\nfour\nfive\n");
  await git(["add", "."], dir);
  await git([...commit, "-m", "base"], dir);
  return { dir, base: await git(["rev-parse", "HEAD"], dir) };
}

describe("gitDiffSummary", () => {
  test("lists added, modified, deleted, renamed and untracked files", async () => {
    const { dir, base } = await based();
    writeFileSync(join(dir, "src/new.ts"), "n1\nn2\n");
    await git(["add", "src/new.ts"], dir);
    writeFileSync(join(dir, "src/keep.ts"), "a\nB\nc\nd\ne\nf\n");
    await git(["rm", "-q", "src/gone.ts"], dir);
    await git(["mv", "src/old.ts", "src/renamed.ts"], dir);
    writeFileSync(join(dir, "src/loose.ts"), "l\n");
    const diff = await gitDiffSummary(runGit, dir, base);
    expect(diff.files).toEqual([
      { path: "src/gone.ts", status: "deleted", added: 0, removed: 1 },
      { path: "src/keep.ts", status: "modified", added: 3, removed: 1 },
      { path: "src/new.ts", status: "added", added: 2, removed: 0 },
      { path: "src/renamed.ts", status: "renamed", added: 0, removed: 0 },
    ]);
    expect(diff.untracked).toEqual(["src/loose.ts"]);
  });

  test("a pathspec narrows the summary to one file", async () => {
    const { dir, base } = await based();
    writeFileSync(join(dir, "src/keep.ts"), "a\nB\nc\nd\n");
    writeFileSync(join(dir, "src/loose.ts"), "l\n");
    const diff = await gitDiffSummary(runGit, dir, base, ["src/loose.ts"]);
    expect(diff).toEqual({ files: [], untracked: ["src/loose.ts"] });
  });

  test("a failing git raises GIT_FAILED", async () => {
    const { dir } = await based();
    const err = await gitDiffSummary(runGit, dir, "f".repeat(40)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KiboError);
    expect((err as KiboError).code).toBe("GIT_FAILED");
  });

  test("every git call carries the duplication timeout", async () => {
    const { dir, base } = await based();
    const timeouts: (number | undefined)[] = [];
    const spy: GitRunner = (args, cwd, timeoutMs) => {
      timeouts.push(timeoutMs);
      return runGit(args, cwd, timeoutMs);
    };
    await gitDiffSummary(spy, dir, base);
    await addedLinesOf(spy, dir, base, "src/keep.ts");
    expect(timeouts.length).toBeGreaterThan(2);
    expect(new Set(timeouts)).toEqual(new Set([10_000]));
  });
});

describe("addedLinesOf", () => {
  test("gives the added lines with their numbers in the current file", async () => {
    const { dir, base } = await based();
    writeFileSync(join(dir, "src/keep.ts"), "a\nB\nc\nd\ne\nf\n");
    expect(await addedLinesOf(runGit, dir, base, "src/keep.ts")).toEqual([
      { line: 2, text: "B" },
      { line: 5, text: "e" },
      { line: 6, text: "f" },
    ]);
  });

  test("an untracked file is entirely added", async () => {
    const { dir, base } = await based();
    writeFileSync(join(dir, "src/loose.ts"), "l1\n\nl3");
    expect(await addedLinesOf(runGit, dir, base, "src/loose.ts")).toEqual([
      { line: 1, text: "l1" },
      { line: 2, text: "" },
      { line: 3, text: "l3" },
    ]);
  });
});
