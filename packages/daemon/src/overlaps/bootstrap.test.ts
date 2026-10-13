import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentsState,
  DEFAULT_DUPLICATION_SETTINGS,
  type HookPayload,
  type MomentData,
  type RunView,
} from "@kibo/schema";
import { cleanupTmp, tmp } from "../agents/git-test-kit";
import type { HookSink } from "../agents/hook-route";
import type { GitRunner } from "../agents/workspace-prep";
import { LOCAL_DUPLICATION_KEY } from "../project-folder";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { type Overlaps, startOverlaps } from "./bootstrap";
import { NOW, ticketRun } from "./peek-fakes.test-helper";

const homes: string[] = [];
const started: Overlaps[] = [];

afterEach(async () => {
  for (const o of started.splice(0)) await o.stop();
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
  cleanupTmp();
});

function boot(over: { enabled?: boolean; runs?: RunView[] } = {}) {
  const home = mkdtempSync(join(tmpdir(), "kibo-overlaps-boot-"));
  homes.push(home);
  const ticks: (() => void)[] = [];
  const cancelled: number[] = [];
  const gitCalls: string[][] = [];
  const emits: unknown[] = [];
  const notes: { runId: string; data: MomentData }[] = [];
  const git: GitRunner = async (args) => {
    gitCalls.push(args);
    return { code: 1, stdout: "", stderr: "no repository" };
  };
  const settings = { ...DEFAULT_DUPLICATION_SETTINGS, enabled: over.enabled ?? true };
  const overlaps = startOverlaps({
    home,
    docs: {
      run: () => null,
      project: () => {
        throw new Error("no project in this test");
      },
      projectIds: () => [],
      emit: (message) => emits.push(message),
      assertWritable: () => undefined,
    },
    settings: { get: (_projectId, key) => (key === LOCAL_DUPLICATION_KEY ? JSON.stringify(settings) : null) },
    trace: {
      trace: () => null,
      note: (runId, data) => {
        notes.push({ runId, data });
        return { id: 1, runId, at: NOW, seq: 1, stepId: null, data };
      },
    },
    runs: () => over.runs ?? [],
    viewer: "adam",
    git,
    now: () => NOW,
    log: () => undefined,
    timers: {
      every(fn, ms) {
        expect(ms).toBe(300_000);
        ticks.push(fn);
        return () => cancelled.push(ms);
      },
    },
  });
  started.push(overlaps);
  return { overlaps, ticks, cancelled, gitCalls, emits, notes };
}

const twoRuns = () => [ticketRun("r1", "BOU-12", { cwd: tmp() }), ticketRun("r2", "BOU-15", { cwd: tmp() })];

test("startOverlaps arms one sweep timer and stop clears it", async () => {
  const { overlaps, ticks, cancelled } = boot();
  expect(ticks).toHaveLength(1);
  await overlaps.stop();
  started.splice(0);
  expect(cancelled).toEqual([300_000]);
});

test("a tick sweeps the projects of the live runs, and detection off never looks at a workspace", async () => {
  const on = boot({ runs: twoRuns() });
  on.ticks[0]?.();
  await Bun.sleep(20);
  expect(on.gitCalls.length).toBeGreaterThan(0);
  const off = boot({ enabled: false, runs: twoRuns() });
  off.ticks[0]?.();
  await Bun.sleep(20);
  expect(off.gitCalls).toEqual([]);
});

test("the agents port gains the overlap aggregates", () => {
  const { overlaps } = boot();
  const state = { runs: [], signals: [] } as unknown as AgentsState;
  expect(overlaps.agents({ state: () => state }).state()).toMatchObject({ overlaps: [], overlapTotal: 0 });
});

test("the parallel work of an unknown run is NOT_FOUND", async () => {
  const { overlaps } = boot();
  await expect(
    overlaps.rpc.handle({ method: "overlaps.parallel", runId: "absent" }, LOCAL_CONTEXT),
  ).rejects.toThrow("NOT_FOUND");
});

test("the lifecycle runs the base hooks first and still sweeps when they fail", async () => {
  const { overlaps, gitCalls } = boot({ runs: twoRuns() });
  const order: string[] = [];
  const lifecycle = overlaps.lifecycle({
    onSpawned: async (run) => {
      order.push(`spawned ${run.id}`);
    },
    onTurnEnd: async () => {
      order.push("turn end");
      throw new Error("progress failed");
    },
    onFailed: async () => undefined,
  });
  await lifecycle.onSpawned(ticketRun("r2", "BOU-15"));
  await expect(
    lifecycle.onTurnEnd(ticketRun("r2", "BOU-15", { state: "done", endedAt: NOW })),
  ).rejects.toThrow("progress failed");
  await Bun.sleep(20);
  expect(order).toEqual(["spawned r2", "turn end"]);
  expect(gitCalls.length).toBeGreaterThan(0);
});

test("a run failed before its start forgets its section without any turn end", async () => {
  const runs = twoRuns();
  const { overlaps } = boot({ runs });
  const order: string[] = [];
  const lifecycle = overlaps.lifecycle({
    onSpawned: async () => {
      order.push("spawned");
    },
    onTurnEnd: async () => {
      order.push("turn end");
    },
    onFailed: async (run) => {
      order.push(`failed ${run.id}`);
    },
  });
  const run = runs[1] ?? ticketRun("r2", "BOU-15");
  const first = await overlaps.prefixer.changedSection(run);
  expect(first).not.toBeNull();
  expect(await overlaps.prefixer.changedSection(run)).toBeNull();
  await lifecycle.onFailed({ ...run, state: "failed", endedAt: NOW });
  expect(order).toEqual(["failed r2"]);
  expect(await overlaps.prefixer.changedSection(run)).toBe(first);
});

test("the hooks pass a PreToolUse through untouched when nothing waits", () => {
  const { overlaps } = boot();
  const inner: HookSink = { verify: () => true, receive: () => null };
  const payload = { event: "PreToolUse", tool: "Read", detail: "/x" } as HookPayload;
  expect(overlaps.hooks(inner).receive("r1", payload, {})).toBeNull();
  expect(overlaps.reminders.openDeliveredOverlaps("r1")).toEqual([]);
});
