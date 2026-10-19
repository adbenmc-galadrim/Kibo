import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { batchStatusOfResults, foldBatch, isDecidable, undecidedActionIds } from "./batch-fold";
import type { ActionResult, BatchRow, TimedBatchEvent } from "./project-agent";

const HUMAN = { kind: "human" as const, ref: "adam" };
const OUTCOMES = ["applied", "stale", "failed", "skipped"] as const;

const rowOf = (count: number): BatchRow => ({
  id: "b1",
  projectId: "p1",
  runId: "r1",
  sessionId: "s1",
  seq: 7,
  summary: "Fin de sprint",
  actions: Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    why: "",
    type: "setStatus" as const,
    ticket: `SILO-${i + 1}`,
    statusId: "done",
  })),
  expected: [],
  createdAt: 0,
});
const result = (actionId: number, outcome: ActionResult["outcome"]): ActionResult => ({
  actionId,
  outcome,
  detail: null,
  created: null,
});
const decided = (
  at: number,
  decision: "apply" | "reject",
  actionIds: number[],
  keepRest = true,
): TimedBatchEvent => ({
  at,
  event: { type: "decided", decision, by: HUMAN, actionIds, comment: null, keepRest },
});
const results = (at: number, list: ActionResult[]): TimedBatchEvent => ({
  at,
  event: { type: "results", results: list },
});

describe("partial decision of a batch", () => {
  test("keepRest applies some actions and leaves the batch pending with the rest undecided", () => {
    const row = rowOf(3);
    const batch = foldBatch(row, [decided(1, "apply", [1]), results(2, [result(1, "applied")])]);
    expect(batch).toMatchObject({ status: "pending", decidedBy: HUMAN, decidedAt: 1, chosen: [1] });
    expect(batch.results).toEqual([result(1, "applied")]);
    expect(isDecidable(batch)).toBe(true);
    expect(undecidedActionIds(batch)).toEqual([2, 3]);
  });

  test("an action being applied is no longer undecided before its result", () => {
    const batch = foldBatch(rowOf(3), [decided(1, "apply", [2])]);
    expect(batch.status).toBe("pending");
    expect(undecidedActionIds(batch)).toEqual([1, 3]);
  });

  test("the last undecided action closes the batch with a status computed on every result", () => {
    const row = rowOf(2);
    const applied = foldBatch(row, [
      decided(1, "apply", [1]),
      results(2, [result(1, "applied")]),
      decided(3, "apply", [2]),
      results(4, [result(2, "applied")]),
    ]);
    expect(applied).toMatchObject({ status: "applied", decidedAt: 3, chosen: [1, 2] });
    const partial = foldBatch(row, [
      decided(1, "apply", [1]),
      results(2, [result(1, "applied")]),
      decided(3, "reject", [2]),
      results(3, [result(2, "skipped")]),
    ]);
    expect(partial.status).toBe("partial");
    expect(partial.results.map((r) => r.actionId)).toEqual([1, 2]);
  });

  test("a partly decided batch superseded or abandoned turns partial", () => {
    const row = rowOf(2);
    const started = [decided(1, "apply", [1]), results(2, [result(1, "applied")])];
    expect(foldBatch(row, [...started, { at: 3, event: { type: "superseded" } }]).status).toBe("partial");
    expect(foldBatch(row, [...started, { at: 3, event: { type: "abandoned" } }]).status).toBe("partial");
    expect(foldBatch(row, [{ at: 3, event: { type: "superseded" } }]).status).toBe("superseded");
  });

  test("a decision without keepRest closes a partly decided batch on all its results", () => {
    const batch = foldBatch(rowOf(3), [
      decided(1, "apply", [1]),
      results(2, [result(1, "applied")]),
      decided(3, "apply", [2], false),
      results(4, [result(2, "applied"), result(3, "skipped")]),
    ]);
    expect(batch.status).toBe("partial");
    expect(batch.results.map((r) => r.outcome)).toEqual(["applied", "applied", "skipped"]);
  });

  test("any sequence of partial decisions decides each action once and ends on all results", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            fc.shuffledSubarray(
              Array.from({ length: n }, (_, i) => i + 1),
              { minLength: n, maxLength: n },
            ),
            fc.array(fc.integer({ min: 1, max: 3 }), { minLength: n, maxLength: n }),
            fc.array(fc.constantFrom(...OUTCOMES), { minLength: n, maxLength: n }),
          ),
        ),
        ([n, order, sizes, outcomes]) => {
          const row = rowOf(n);
          const events: TimedBatchEvent[] = [];
          let at = 0;
          let rest = [...order];
          let k = 0;
          while (rest.length > 0) {
            const before = foldBatch(row, events);
            expect(before.status).toBe("pending");
            const take = rest.slice(0, sizes[k] ?? 1);
            rest = rest.slice(take.length);
            k += 1;
            for (const id of take) expect(undecidedActionIds(before)).toContain(id);
            events.push(decided(++at, "apply", take));
            events.push(
              results(
                ++at,
                take.map((id) => result(id, outcomes[id - 1] ?? "applied")),
              ),
            );
          }
          const end = foldBatch(row, events);
          const all = row.actions.map((a) => result(a.id, outcomes[a.id - 1] ?? "applied"));
          expect(end.results).toEqual(all);
          expect(end.status).toBe(batchStatusOfResults(all));
          expect(undecidedActionIds(end)).toEqual([]);
        },
      ),
    );
  });
});
