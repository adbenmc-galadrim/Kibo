import { expect, test } from "bun:test";
import type { TabTarget } from "@kibo/schema";
import { hashToTarget, targetToHash } from "./target-hash";

const run: TabTarget = { kind: "run", runId: "r1" };

test("a run has its own address", () => {
  expect(targetToHash(run)).toBe("#/runs/r1");
  expect(hashToTarget("#/runs/r1")).toEqual(run);
});

test("a run address survives a round trip, even with odd characters", () => {
  const odd: TabTarget = { kind: "run", runId: "run 4/é" };
  expect(hashToTarget(targetToHash(odd))).toEqual(odd);
  expect(hashToTarget("#/runs/r1/")).toEqual(run);
});

test("a run address without an id or with a broken one is no target", () => {
  expect(hashToTarget("#/runs/")).toBeNull();
  expect(hashToTarget("#/runs")).toBeNull();
  expect(hashToTarget("#/runs/%E0%A4%A")).toBeNull();
  expect(hashToTarget("#/runs/a/b")).toBeNull();
});
