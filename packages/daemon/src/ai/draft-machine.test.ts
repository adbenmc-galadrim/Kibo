import { describe, expect, test } from "bun:test";
import { type ComponentDraft, MAX_DRAFT_REVISIONS } from "@kibo/schema";
import { applyDraftEvent, canRetry, canRevise, isActive } from "./draft-machine";

const d0: ComponentDraft = {
  id: "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11",
  componentId: "burndown",
  mode: "create",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  baseVersion: null,
  description: "Burndown du sprint : tickets restants par jour.",
  runId: null,
  sessionId: null,
  status: "describing",
  attempts: 0,
  failure: null,
  incidents: [],
  attachments: [],
  revisions: 0,
  createdAt: 1,
  updatedAt: 1,
};
const run = (d: ComponentDraft, runId = "r1") => applyDraftEvent(d, { type: "enqueued", runId }, 2);
const end = (d: ComponentDraft, state: "done" | "failed" | "cancelled", runId = "r1") =>
  applyDraftEvent(
    d,
    { type: "run_ended", runId, state, sessionId: "s1", error: state === "failed" ? "exit 1" : null },
    3,
  );

describe("applyDraftEvent", () => {
  test("happy path to done", () => {
    let d = end(run(d0), "done");
    expect(d).toMatchObject({ status: "validating", attempts: 1, sessionId: "s1", runId: "r1" });
    d = applyDraftEvent(
      d,
      { type: "restored", incidents: [{ kind: "restored", path: "kibo.component.json" }] },
      4,
    );
    d = applyDraftEvent(d, { type: "validated", ok: true }, 5);
    expect(d.status).toBe("review");
    d = applyDraftEvent(applyDraftEvent(d, { type: "reviewed" }, 6), { type: "finalized" }, 7);
    expect(d).toMatchObject({ status: "done", updatedAt: 7, incidents: [{ path: "kibo.component.json" }] });
  });
  test("failed runs and validations record their failure", () => {
    expect(end(run(d0), "failed").failure).toEqual({ kind: "run_failed", detail: "exit 1" });
    expect(end(run(d0), "cancelled").failure).toEqual({ kind: "run_cancelled", detail: null });
    const v = applyDraftEvent(end(run(d0), "done"), { type: "validated", ok: false }, 4);
    expect(v).toMatchObject({ status: "failed", failure: { kind: "validation" } });
    const c = applyDraftEvent(end(run(d0), "done"), { type: "validation_crashed", detail: "tsc missing" }, 4);
    expect(c.failure).toEqual({ kind: "validation", detail: "tsc missing" });
  });
  test("a stale run end is ignored", () => {
    const d = run(d0, "r2");
    expect(end(d, "done", "r1")).toBe(d);
  });
  test("three attempts at most, and a retry clears the previous failure and incidents", () => {
    let d = d0;
    for (const id of ["r1", "r2", "r3"]) {
      d = applyDraftEvent(end(run(d, id), "done", id), { type: "validated", ok: false }, 5);
    }
    expect(d.attempts).toBe(3);
    expect(canRetry(d)).toBe(false);
    expect(() => run(d, "r4")).toThrow("INVALID_INPUT");
  });
  test("a retry starts a fresh attempt", () => {
    const restored = applyDraftEvent(
      end(run(d0), "done"),
      { type: "restored", incidents: [{ kind: "removed", path: "evil.ts" }] },
      4,
    );
    const failed = applyDraftEvent(restored, { type: "validated", ok: false }, 5);
    expect(canRetry(failed)).toBe(true);
    expect(run(failed, "r2")).toMatchObject({
      status: "generating",
      runId: "r2",
      attempts: 2,
      failure: null,
      incidents: [],
    });
  });
  test("a run end outside generation is ignored", () => {
    const validating = end(run(d0), "done");
    expect(end(validating, "failed")).toBe(validating);
    expect(() => applyDraftEvent(run(d0), { type: "restored", incidents: [] }, 3)).toThrow("INVALID_INPUT");
  });
  test("illegal transitions throw", () => {
    expect(() => applyDraftEvent(d0, { type: "reviewed" }, 2)).toThrow("INVALID_INPUT");
    expect(() => run(run(d0))).toThrow("INVALID_INPUT");
    const done = { ...d0, status: "done" } as const;
    expect(() => applyDraftEvent(done, { type: "abandoned" }, 2)).toThrow("INVALID_INPUT");
  });
  test("revalidation and interruption", () => {
    const failed = applyDraftEvent(end(run(d0), "done"), { type: "validated", ok: false }, 4);
    expect(applyDraftEvent(failed, { type: "validation_started" }, 5)).toMatchObject({
      status: "validating",
      failure: null,
    });
    expect(applyDraftEvent(run(d0), { type: "interrupted" }, 5).failure).toEqual({
      kind: "interrupted",
      detail: null,
    });
    const config = applyDraftEvent(
      applyDraftEvent(failed, { type: "validation_started" }, 5),
      { type: "config_changed" },
      6,
    );
    expect(canRetry(config)).toBe(false);
  });
  test("isActive", () => {
    expect(isActive(d0)).toBe(true);
    expect(isActive(applyDraftEvent(d0, { type: "abandoned" }, 2))).toBe(false);
  });
  test("a revision relaunches a reviewed draft with fresh attempts", () => {
    const review: ComponentDraft = {
      ...d0,
      status: "review",
      runId: "r3",
      sessionId: "s1",
      attempts: 3,
      incidents: [{ kind: "removed", path: "evil.ts" }],
    };
    const revised = applyDraftEvent(review, { type: "revised", runId: "r4" }, 9);
    expect(revised).toMatchObject({
      status: "generating",
      runId: "r4",
      sessionId: "s1",
      attempts: 1,
      revisions: 1,
      failure: null,
      incidents: [],
      updatedAt: 9,
    });
    const permissions: ComponentDraft = { ...review, status: "permissions" };
    expect(applyDraftEvent(permissions, { type: "revised", runId: "r4" }, 9).status).toBe("generating");
    expect(canRevise(review)).toBe(true);
    expect(canRevise(permissions)).toBe(true);
  });
  test("a revision is refused outside review and after ten", () => {
    for (const status of ["describing", "generating", "validating", "failed", "done", "abandoned"] as const) {
      expect(canRevise({ ...d0, status })).toBe(false);
      expect(() => applyDraftEvent({ ...d0, status }, { type: "revised", runId: "r2" }, 2)).toThrow(
        "INVALID_INPUT",
      );
    }
    const spent = { ...d0, status: "review", revisions: MAX_DRAFT_REVISIONS } as const;
    expect(canRevise(spent)).toBe(false);
    expect(() => applyDraftEvent(spent, { type: "revised", runId: "r2" }, 2)).toThrow("no revision left");
  });
});
