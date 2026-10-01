import { expect, test } from "bun:test";
import type { ComponentDraft } from "@kibo/schema";
import { failingReport } from "./draft-fixtures";
import { draftActions, draftStep, problemCount } from "./draft-flow";

const d = (patch: Partial<ComponentDraft>): ComponentDraft => ({
  id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
  componentId: "burndown",
  mode: "create",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  baseVersion: null,
  description: "Burndown du sprint : tickets restants par jour.",
  runId: "r1",
  sessionId: "s1",
  status: "failed",
  attempts: 1,
  failure: { kind: "validation", detail: null },
  incidents: [],
  attachments: [],
  revisions: 0,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

test("draftStep maps statuses to the five pills", () => {
  expect(draftStep(null)).toBe(1);
  expect(
    (["describing", "generating", "validating", "failed", "review", "permissions", "done"] as const).map(
      (status) => draftStep({ status }),
    ),
  ).toEqual([1, 2, 3, 3, 3, 4, 5]);
});

test("draftActions: retry until 3 attempts, then the code fallback", () => {
  expect(draftActions(d({}))).toEqual({ canRetry: true, codeFallback: false, canAbandon: true });
  expect(draftActions(d({ attempts: 3 }))).toEqual({ canRetry: false, codeFallback: true, canAbandon: true });
  expect(draftActions(d({ failure: { kind: "config_changed", detail: null } })).codeFallback).toBe(true);
  expect(draftActions(d({ status: "done" })).canAbandon).toBe(false);
});

test("problemCount counts every failing section of the report", () => {
  expect(problemCount(failingReport)).toBe(1);
  expect(
    problemCount({
      ...failingReport,
      manifest: { ok: false, errors: ["x"] },
      tests: { ok: false, passed: 0, failed: 1, output: "" },
      permissions: { ...failingReport.permissions, missing: ["net"], unused: ["read:page"] },
    }),
  ).toBe(4);
});
