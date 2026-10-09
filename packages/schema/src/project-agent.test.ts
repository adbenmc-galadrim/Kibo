import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  ACTION_GROUPS,
  type ActionResult,
  type BatchRow,
  batchStatusOfResults,
  foldBatch,
  isDecidable,
  ProposeBatchInput,
  ProposedAction,
  TicketRef,
} from "./project-agent";

const HUMAN = { kind: "human" as const, ref: "adam" };
const OUTCOMES = ["applied", "stale", "failed", "skipped"] as const;
const one = { id: 1, why: "", type: "deliverAnswers", ticket: "EMIS-1" };
const row: BatchRow = {
  id: "b1",
  projectId: "p1",
  runId: "r1",
  sessionId: "s1",
  seq: 1,
  summary: "Ranger le backlog",
  actions: [
    { id: 1, why: "", type: "setStatus", ticket: "EMIS-1", statusId: "done" },
    { id: 2, why: "", type: "setStatus", ticket: "EMIS-2", statusId: "todo" },
  ],
  expected: [],
  createdAt: 0,
};
const result = (actionId: number, outcome: ActionResult["outcome"]): ActionResult => ({
  actionId,
  outcome,
  detail: null,
  created: null,
});
const ok = (id: number) => result(id, "applied");
const stale = (id: number) => result(id, "stale");

describe("project agent schema", () => {
  test("a proposed action carries a rank and a short why, and refs are new:<n> or keys", () => {
    expect(
      ProposedAction.safeParse({
        id: 1,
        why: "",
        type: "setStatus",
        ticket: "EMIS-11",
        statusId: "in_review",
      }).success,
    ).toBe(true);
    expect(
      ProposedAction.safeParse({ id: 1, why: "x".repeat(301), type: "deliverAnswers", ticket: "new:1" })
        .success,
    ).toBe(false);
    expect(ProposedAction.safeParse({ id: 0, why: "", type: "cancelRun", runId: "r1" }).success).toBe(false);
    expect(TicketRef.safeParse("new:0").success).toBe(false);
    expect(TicketRef.safeParse("emis-11").success).toBe(false);
    expect(
      ProposedAction.safeParse({ id: 2, why: "", type: "createNote", path: "../x.md", content: "" }).success,
    ).toBe(false);
    expect(
      ProposedAction.safeParse({ id: 2, why: "", type: "link", from: "EMIS-1", to: "new:1", kind: "relates" })
        .success,
    ).toBe(false);
    expect(
      ProposedAction.safeParse({
        id: 2,
        why: "",
        type: "unlink",
        from: "EMIS-1",
        to: "EMIS-2",
        kind: "relates",
      }).success,
    ).toBe(true);
  });

  test("a batch needs a summary and at least one action, with no maximum", () => {
    expect(ProposeBatchInput.safeParse({ summary: " ", actions: [one] }).success).toBe(false);
    expect(ProposeBatchInput.safeParse({ summary: "ok", actions: [] }).success).toBe(false);
    const many = Array.from({ length: 300 }, (_, i) => ({ ...one, id: i + 1 }));
    expect(ProposeBatchInput.safeParse({ summary: "ok", actions: many }).success).toBe(true);
  });

  test("foldBatch derives the status from its events", () => {
    expect(foldBatch(row, []).status).toBe("pending");
    expect(isDecidable(foldBatch(row, []))).toBe(true);
    expect(
      foldBatch(row, [
        { at: 1, event: { type: "decided", decision: "reject", by: HUMAN, actionIds: null, comment: "non" } },
      ]),
    ).toMatchObject({ status: "rejected", comment: "non", decidedBy: HUMAN, decidedAt: 1 });
    const decided = {
      at: 1,
      event: {
        type: "decided" as const,
        decision: "apply" as const,
        by: HUMAN,
        actionIds: [1, 2],
        comment: null,
      },
    };
    const applied = [decided, { at: 2, event: { type: "results" as const, results: [ok(1), ok(2)] } }];
    expect(foldBatch(row, applied)).toMatchObject({
      status: "applied",
      chosen: [1, 2],
      results: [ok(1), ok(2)],
    });
    expect(isDecidable(foldBatch(row, applied))).toBe(false);
    expect(isDecidable(foldBatch(row, [decided]))).toBe(false);
    expect(
      foldBatch(row, [decided, { at: 2, event: { type: "results", results: [ok(1), stale(2)] } }]).status,
    ).toBe("partial");
    expect(foldBatch(row, [{ at: 1, event: { type: "superseded" } }]).status).toBe("superseded");
    expect(foldBatch(row, [{ at: 1, event: { type: "abandoned" } }]).status).toBe("abandoned");
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...OUTCOMES), { minLength: 1 }), (outcomes) => {
        const results = outcomes.map((o, i) => result(i + 1, o));
        const expected = outcomes.every((o) => o === "applied") ? "applied" : "partial";
        return batchStatusOfResults(results) === expected;
      }),
    );
  });

  test("ACTION_GROUPS covers every action type", () => {
    for (const type of ProposedAction.options.map((o) => o.shape.type.value)) {
      expect(ACTION_GROUPS[type]).toBeDefined();
    }
  });
});
