import { expect, test } from "bun:test";
import {
  MOMENT_ACTIONS_MAX,
  MOMENT_MESSAGE_MAX,
  MOMENT_RAW_MAX,
  MomentData,
  RunAction,
  RunMoment,
  TRANSCRIPT_PASS_MAX_BYTES,
} from "./moment";

const READ: RunAction = {
  tool: "Read",
  kind: "read",
  label: "A lu `a.ts`",
  target: "a.ts",
  outcome: "ok",
  detail: null,
  patch: null,
  tests: null,
};

test("each moment kind parses", () => {
  const samples: MomentData[] = [
    { kind: "message", text: "Je commence." },
    { kind: "actions", actions: [READ], summary: "A lu 1 fichier", failed: false },
    { kind: "reasoning", text: "Réfléchir." },
    { kind: "reminder", reminder: "plan" },
    { kind: "raw", text: "{}", partial: null },
    { kind: "raw", text: "", partial: "path-rejected" },
  ];
  for (const sample of samples) expect(MomentData.parse(sample)).toEqual(sample);
});

test("moment texts and action groups are bounded", () => {
  expect(MomentData.safeParse({ kind: "message", text: "x".repeat(MOMENT_MESSAGE_MAX + 1) }).success).toBe(
    false,
  );
  expect(MomentData.safeParse({ kind: "actions", actions: [], summary: "", failed: false }).success).toBe(
    false,
  );
  const many = Array.from({ length: MOMENT_ACTIONS_MAX + 1 }, () => READ);
  expect(MomentData.safeParse({ kind: "actions", actions: many, summary: "", failed: false }).success).toBe(
    false,
  );
  expect(
    MomentData.safeParse({ kind: "raw", text: "x".repeat(MOMENT_RAW_MAX + 1), partial: null }).success,
  ).toBe(false);
  expect(TRANSCRIPT_PASS_MAX_BYTES).toBe(4 * 1024 * 1024);
});

test("an action outside the known kinds is refused", () => {
  expect(RunAction.safeParse({ ...READ, kind: "teleport" }).success).toBe(false);
  expect(RunAction.safeParse({ ...READ, outcome: "maybe" }).success).toBe(false);
});

test("a stored moment parses with its step", () => {
  const moment: RunMoment = {
    id: 3,
    runId: "r1",
    seq: 2,
    at: 1_760_000_000_000,
    stepId: "s2",
    data: { kind: "message", text: "Je corrige la validation." },
  };
  expect(RunMoment.parse(moment)).toEqual(moment);
  expect(RunMoment.safeParse({ ...moment, seq: -1 }).success).toBe(false);
});

test("a signal moment carries its reference and kind", () => {
  const signal = { kind: "signal", signalId: "s1", ref: "sig:1", signalKind: "blocker", title: "x" } as const;
  expect(MomentData.parse(signal)).toEqual(signal);
  expect(MomentData.safeParse({ ...signal, ref: "nope" }).success).toBe(false);
  expect(MomentData.safeParse({ ...signal, title: "x".repeat(201) }).success).toBe(false);
});
