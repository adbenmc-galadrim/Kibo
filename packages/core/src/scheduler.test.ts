import { describe, expect, test } from "bun:test";
import type { HostSettings, RunView } from "@kibo/schema";
import { defaultHostSlots, headRank, orderQueue, planAdmissions, rankForMove, tailRank } from "./scheduler";

let seq = 0;
function run(p: Partial<RunView> & Pick<RunView, "id">): RunView {
  seq += 1;
  return {
    seq,
    projectId: "p1",
    ticketId: `t-${p.id}`,
    ticketKey: "KIB-1",
    ticketTitle: "Ticket",
    profileId: "opus",
    profileName: "opus-dev",
    sessionId: `s-${p.id}`,
    brief: "",
    kind: "ticket",
    resumedFrom: null,
    createdAt: 0,
    label: "opus-dev",
    state: "queued",
    lane: null,
    priority: false,
    rank: seq,
    question: null,
    pendingAnswer: null,
    lastActivity: null,
    subagents: [],
    workspace: null,
    cwd: null,
    guidelines: 0,
    transcriptPath: null,
    tokens: 0,
    costUsd: 0,
    denied: [],
    error: null,
    output: null,
    stateSince: 0,
    startedAt: null,
    endedAt: null,
    turns: 0,
    activeMs: 0,
    turnStartedAt: null,
    session: null,
    ...p,
  };
}
const sonnet = { profileId: "sonnet", profileName: "sonnet-review" };
const profiles = [
  { id: "opus", name: "opus-dev", maxParallel: 2 },
  { id: "sonnet", name: "sonnet-review", maxParallel: 3 },
];
const settings: HostSettings = { hostSlots: 3, cpuThreshold: 85, ramThreshold: 90, paused: false };
const idle = { cpu: 10, ram: 40 };

describe("admission", () => {
  test("4 runs on 3 host slots: 3 start, 1 waits for a host slot", () => {
    const runs = ["a", "b", "c", "d"].map((id) => run({ id, ...sonnet }));
    const plan = planAdmissions({
      runs,
      profiles: [{ id: "sonnet", name: "sonnet-review", maxParallel: 4 }],
      settings,
      load: idle,
    });
    expect(plan.admit).toEqual([
      { runId: "a", lane: 1 },
      { runId: "b", lane: 2 },
      { runId: "c", lane: 3 },
    ]);
    expect(plan.waiting).toEqual([{ runId: "d", position: 1, reason: { kind: "host", used: 3, total: 3 } }]);
  });

  test("a full profile does not block a run of another profile behind it", () => {
    const runs = [
      run({ id: "r1", state: "running", lane: 1 }),
      run({ id: "r2", state: "starting", lane: 2 }),
      run({ id: "q1" }),
      run({ id: "q2", ...sonnet }),
    ];
    const plan = planAdmissions({ runs, profiles, settings, load: idle });
    expect(plan.admit).toEqual([{ runId: "q2", lane: 1 }]);
    expect(plan.waiting).toEqual([
      { runId: "q1", position: 1, reason: { kind: "profile", profileName: "opus-dev", used: 2, total: 2 } },
    ]);
  });

  test("waiting_input frees the slot but keeps its lane", () => {
    const runs = [
      run({ id: "r1", state: "running", lane: 1 }),
      run({ id: "w2", state: "waiting_input", lane: 2 }),
      run({ id: "q1" }),
    ];
    expect(planAdmissions({ runs, profiles, settings, load: idle }).admit).toEqual([
      { runId: "q1", lane: 3 },
    ]);
  });

  test("terminal runs hold nothing", () => {
    const runs = [
      run({ id: "d1", state: "done", lane: 1 }),
      run({ id: "f1", state: "failed", lane: 2 }),
      run({ id: "q1" }),
    ];
    expect(planAdmissions({ runs, profiles, settings, load: idle }).admit).toEqual([
      { runId: "q1", lane: 1 },
    ]);
  });

  test("pause, then CPU, then RAM stop every admission", () => {
    const runs = [run({ id: "q1" }), run({ id: "q2", ...sonnet })];
    const paused = planAdmissions({ runs, profiles, settings: { ...settings, paused: true }, load: idle });
    expect(paused.admit).toEqual([]);
    expect(paused.waiting.map((w) => w.reason)).toEqual([{ kind: "paused" }, { kind: "paused" }]);
    const cpu = planAdmissions({ runs, profiles, settings, load: { cpu: 85, ram: 95 } });
    expect(cpu.waiting[0]?.reason).toEqual({ kind: "cpu", value: 85, threshold: 85 });
    const ram = planAdmissions({ runs, profiles, settings, load: { cpu: 84.4, ram: 90.2 } });
    expect(ram.admit).toEqual([]);
    expect(ram.waiting[0]?.reason).toEqual({ kind: "ram", value: 90, threshold: 90 });
  });

  test("a run whose profile is gone never starts", () => {
    const plan = planAdmissions({
      runs: [run({ id: "q1", profileId: "gone" })],
      profiles,
      settings,
      load: idle,
    });
    expect(plan.waiting).toEqual([{ runId: "q1", position: 1, reason: { kind: "profile_missing" } }]);
  });
});

describe("order", () => {
  test("the queue follows rank then sequence; the head rank goes before everyone", () => {
    const runs = [run({ id: "a", rank: 5 }), run({ id: "b", rank: 2 }), run({ id: "c", rank: 2 })];
    expect(orderQueue(runs).map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(headRank(runs)).toBe(1);
    expect(tailRank(runs)).toBe(6);
    expect(headRank([])).toBe(0);
    expect(tailRank([])).toBe(0);
  });

  test("rankForMove places a run between its new neighbours", () => {
    const runs = [run({ id: "a", rank: 1 }), run({ id: "b", rank: 2 }), run({ id: "c", rank: 3 })];
    expect(rankForMove(runs, "c", 0)).toBe(0);
    expect(rankForMove(runs, "a", 1)).toBe(2.5);
    expect(rankForMove(runs, "a", 9)).toBe(4);
    expect(() => rankForMove([run({ id: "r", state: "running" })], "r", 0)).toThrow("INVALID_TRANSITION");
  });
});

test("default host slots follow cores and memory", () => {
  expect(defaultHostSlots({ cores: 8, ramGb: 16 })).toBe(3);
  expect(defaultHostSlots({ cores: 2, ramGb: 4 })).toBe(1);
  expect(defaultHostSlots({ cores: 10, ramGb: 26 })).toBe(5);
  expect(defaultHostSlots({ cores: 64, ramGb: 256 })).toBe(8);
});
