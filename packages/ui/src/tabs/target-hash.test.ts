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

test("a page address may name one question, read back the same way", () => {
  const aimed: TabTarget = { kind: "page", projectId: "p1", pageId: "pg", question: "q 1" };
  expect(targetToHash(aimed)).toBe("#/p/p1/pg?question=q%201");
  expect(hashToTarget("#/p/p1/pg?question=q%201")).toEqual(aimed);
  expect(hashToTarget("#/p/p1/pg")).toEqual({ kind: "page", projectId: "p1", pageId: "pg" });
  expect(targetToHash({ kind: "page", projectId: "p1", pageId: "pg", question: null })).toBe("#/p/p1/pg");
  expect(hashToTarget("#/p/p1/pg?question=")).toEqual({ kind: "page", projectId: "p1", pageId: "pg" });
});

test("the domains page may open on one project folder", () => {
  const aimed: TabTarget = { kind: "screen", screen: "domains", projectId: "p 1" };
  expect(targetToHash(aimed)).toBe("#/settings/domains?project=p%201");
  expect(hashToTarget("#/settings/domains?project=p%201")).toEqual(aimed);
  expect(hashToTarget("#/settings/domains")).toEqual({ kind: "screen", screen: "domains" });
  expect(hashToTarget("#/settings/domains?project=")).toEqual({ kind: "screen", screen: "domains" });
  expect(targetToHash({ kind: "screen", screen: "domains", projectId: null })).toBe("#/settings/domains");
});
