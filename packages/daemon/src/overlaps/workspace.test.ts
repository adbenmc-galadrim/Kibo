import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, realpathSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import type { RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { runGit } from "../runs/workspace-prep";
import { cleanupTmp, repo, tmp, worktree } from "../testing/git-test-kit";
import { workspaceOf } from "./workspace";

afterEach(cleanupTmp);

const BASE = "b".repeat(40);

function setup(base: string | null = BASE) {
  const logs: string[] = [];
  const at = (p: Partial<RunView>) =>
    workspaceOf(
      runView({ id: "r1", ...p }),
      runGit,
      () => base,
      (line) => logs.push(line),
    );
  return { logs, at };
}

describe("workspaceOf", () => {
  test("project runs, isolated and project-agent folders are not workspaces", async () => {
    const r = await repo();
    const { at } = setup();
    expect(await at({ kind: "project", workspace: "repo", cwd: r })).toBeNull();
    expect(await at({ workspace: "isolated", cwd: r })).toBeNull();
    expect(await at({ workspace: "projet", cwd: r })).toBeNull();
    expect(await at({ workspace: "repo", cwd: null })).toBeNull();
    expect(await at({ workspace: null, cwd: r })).toBeNull();
  });

  test("a repo run is keyed by the real path of its folder", async () => {
    const r = await repo();
    const { at } = setup();
    expect(await at({ workspace: "repo", cwd: r })).toEqual({
      key: realpathSync(r),
      kind: "repo",
      worktreeName: null,
      baseHead: BASE,
    });
  });

  test("a worktree run is named after its folder", async () => {
    const r = await repo();
    const wt = await worktree(r, "bou-12");
    const ws = await setup().at({ workspace: "worktree:bou-12", cwd: wt });
    expect(ws).toEqual({ key: wt, kind: "worktree", worktreeName: basename(wt), baseHead: BASE });
  });

  test("a folder without git or gone is not a workspace", async () => {
    const plain = tmp();
    const gone = join(tmp(), "gone");
    mkdirSync(gone);
    rmSync(gone, { recursive: true });
    const { at } = setup();
    expect(await at({ workspace: "repo", cwd: plain })).toBeNull();
    expect(await at({ workspace: "repo", cwd: gone })).toBeNull();
  });

  test("a run without base head is not indexed and logs a partial detection", async () => {
    const r = await repo();
    const { at, logs } = setup(null);
    expect(await at({ workspace: "repo", cwd: r })).toBeNull();
    expect(logs.join("\n")).toContain("détection partielle");
  });

  test("two repo runs on the same folder share the key", async () => {
    const r = await repo();
    const { at } = setup();
    const a = await at({ id: "r1", workspace: "repo", cwd: r });
    const b = await at({ id: "r2", workspace: "repo", cwd: realpathSync(r) });
    expect(a?.key).toBe(b?.key ?? "");
  });

  test("git is asked with the duplication timeout", async () => {
    const r = await repo();
    const timeouts: (number | undefined)[] = [];
    await workspaceOf(
      runView({ id: "r1", workspace: "repo", cwd: r }),
      (args, cwd, timeoutMs) => {
        timeouts.push(timeoutMs);
        return runGit(args, cwd, timeoutMs);
      },
      () => BASE,
      () => {},
    );
    expect(timeouts).toEqual([10_000]);
  });
});
