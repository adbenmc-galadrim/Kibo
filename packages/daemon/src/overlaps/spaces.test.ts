import { afterEach, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import type { RunView } from "@kibo/schema";
import { cleanupTmp, tmp } from "../agents/git-test-kit";
import { NOW, ticketRun } from "./peek-fakes.test-helper";
import { createSpaces } from "./spaces";
import type { WorkspaceRef } from "./workspace";

afterEach(cleanupTmp);

const DAY = 86_400_000;

function spacesOf(runs: RunView[]) {
  return createSpaces({
    runs: () => runs,
    now: () => NOW,
    workspaceOf: async (run) =>
      run.cwd === null || run.workspace === "isolated"
        ? null
        : ({
            key: realpathSync(run.cwd),
            kind: "worktree",
            worktreeName: null,
            baseHead: "base",
          } satisfies WorkspaceRef),
  });
}

test("workspaces group the live ticket runs of a project by folder", async () => {
  const [a, b] = [realpathSync(tmp()), realpathSync(tmp())];
  const runs = [
    ticketRun("r1", "BOU-12", { cwd: a, startedAt: 100 }),
    ticketRun("r2", "BOU-15", { cwd: b, startedAt: 200 }),
    ticketRun("r3", "BOU-16", { cwd: b, startedAt: 300, state: "done", endedAt: NOW - 1_000 }),
    ticketRun("r4", "BOU-17", { cwd: a, state: "done", endedAt: NOW - DAY - 1 }),
    ticketRun("r5", "BOU-18", { cwd: a, workspace: "isolated" }),
    ticketRun("r6", "Q-1", { cwd: a, projectId: "q" }),
  ];
  const spaces = await spacesOf(runs).workspaces("P");
  expect(spaces.map((s) => [s.ws.key, s.allRunIds])).toEqual([
    [a, ["r1"]],
    [b, ["r2", "r3"]],
  ]);
  expect(spaces[1]?.runs).toEqual([
    { key: b, runId: "r2", startedAt: 200 },
    { key: b, runId: "r3", startedAt: 300 },
  ]);
});

test("a workspace is gone when its folder vanished or no live run works in it", () => {
  const [a, b] = [realpathSync(tmp()), realpathSync(tmp())];
  const spaces = spacesOf([
    ticketRun("r1", "BOU-1", { cwd: a }),
    ticketRun("r2", "BOU-2", { cwd: b, state: "done", endedAt: NOW - DAY - 1 }),
  ]);
  expect(spaces.gone(a)).toBe(false);
  expect(spaces.gone(b)).toBe(true);
  expect(spaces.gone(`${a}-absent`)).toBe(true);
});

test("projects lists the projects with a live ticket run", () => {
  const spaces = spacesOf([
    ticketRun("r1", "BOU-1", { projectId: "P" }),
    ticketRun("r2", "BOU-2", { projectId: "P" }),
    ticketRun("r3", "BOU-3", { projectId: "q", state: "cancelled", endedAt: NOW - DAY - 1 }),
  ]);
  expect(spaces.projects()).toEqual(["P"]);
});
