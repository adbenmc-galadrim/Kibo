import { expect, test } from "bun:test";
import type { AgentsState, RunSubagentSummary } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { barSummary, stepChip, subagentCount } from "./bar-summary";
import { agentsFixture, runFixture } from "./fixtures";

const withCounts = (used: number, queued: number, waiting: number): AgentsState => {
  const base = agentsFixture();
  return {
    ...base,
    host: { ...base.host, used, hostSlots: 3 },
    queue: base.queue.slice(0, queued),
    runs: Array.from({ length: waiting }, (_, i) => runFixture({ id: `w${i}`, state: "waiting_input" })),
  };
};

test("the summary says places, queue and waiting runs, with plurals", () => {
  expect(barSummary(withCounts(3, 3, 1), fr.agents)).toBe("3/3 places · 3 en file · 1 attend une réponse");
  expect(barSummary(withCounts(3, 1, 2), fr.agents)).toBe("3/3 places · 1 en file · 2 attendent une réponse");
});

test("the summary speaks of one place in the singular and omits the zero counts", () => {
  expect(barSummary(withCounts(1, 0, 0), fr.agents)).toBe("1/3 place");
  expect(barSummary(withCounts(2, 0, 1), fr.agents)).toBe("2/3 places · 1 attend une réponse");
});

test("a step chip shows the current step of the plan, or nothing", () => {
  const step = { index: 2, total: 5, title: "Corriger la validation" };
  expect(stepChip({ runId: "r1", step, report: null })).toBe("2/5 · Corriger la validation");
  expect(stepChip({ runId: "r1", step: null, report: null })).toBeNull();
  expect(stepChip(undefined)).toBeNull();
});

test("2026-10-14: the summary never speaks of overlaps", () => {
  const state = withCounts(2, 0, 0);
  const both = [
    { runId: "r1", open: 1 },
    { runId: "r2", open: 1 },
  ];
  expect(barSummary({ ...state, overlaps: both, overlapTotal: 2 }, fr.agents)).toBe("2/3 places");
});

test("a delivery step wins over the step of the plan", () => {
  const step = { index: 2, total: 5, title: "Corriger la validation" };
  const delivery = { runId: "r1", step: 7, note: "gates verts" };
  expect(stepChip({ runId: "r1", step, report: null }, delivery)).toBe("7 · Porte qualité");
  expect(stepChip(undefined, delivery)).toBe("7 · Porte qualité");
  expect(stepChip({ runId: "r1", step, report: null }, undefined)).toBe("2/5 · Corriger la validation");
});

const sub = (id: string): RunSubagentSummary => ({
  runId: "r42",
  id,
  type: "Explore",
  description: "Repérage",
  state: "running",
  startedAt: 0,
});

test("screen 218: the summary counts the active sub-agents", () => {
  const state = { ...withCounts(1, 0, 0), subagents: [sub("a"), sub("b")] };
  expect(subagentCount(state)).toBe(2);
  expect(barSummary(state, fr.agents)).toBe("1/3 place · 2 sous-agents");
  expect(barSummary({ ...state, subagents: [sub("a")] }, fr.agents)).toBe("1/3 place · 1 sous-agent");
  expect(subagentCount(withCounts(1, 0, 0))).toBe(0);
});
