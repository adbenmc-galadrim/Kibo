import { describe, expect, test } from "bun:test";
import type { ActionOutcome, ActionResult, ProposedAction } from "@kibo/schema";
import { signalOutcomes } from "./outcomes";

const result = (actionId: number, outcome: ActionOutcome): ActionResult => ({
  actionId,
  outcome,
  detail: null,
  created: null,
});
const actions: ProposedAction[] = [
  { id: 1, why: "", type: "createTicket", ref: "new:1", title: "Tests", signals: ["sig:1"] },
  { id: 2, why: "", type: "setStatus", ticket: "KIB-16", statusId: "todo", signals: ["sig:2", "sig:1"] },
  { id: 3, why: "sans suite", type: "dismissSignal", signal: "sig:3" },
  { id: 4, why: "", type: "updateNote", path: "a.md", content: "" },
];
const batch = { id: "b1", actions };

describe("signalOutcomes", () => {
  test("applied actions settle their signals, others leave them open", () => {
    const results = [result(1, "applied"), result(2, "stale"), result(3, "applied"), result(4, "applied")];
    expect(signalOutcomes(batch, results)).toEqual({
      handled: [{ ref: "sig:1", batchId: "b1", actionId: 1 }],
      ignored: [{ ref: "sig:3", batchId: "b1", actionId: 3 }],
    });
  });

  test("a skipped or failed dismissal ignores nothing", () => {
    for (const outcome of ["skipped", "failed", "stale"] as const) {
      expect(signalOutcomes(batch, [result(3, outcome)]).ignored).toEqual([]);
    }
  });

  test("a signal cited twice is settled by the first applied action", () => {
    const results = [result(1, "applied"), result(2, "applied")];
    expect(signalOutcomes(batch, results).handled).toEqual([
      { ref: "sig:1", batchId: "b1", actionId: 1 },
      { ref: "sig:2", batchId: "b1", actionId: 2 },
    ]);
  });

  test("results follow the order of the actions, not their own order", () => {
    const results = [result(2, "applied"), result(1, "applied")];
    expect(signalOutcomes(batch, results).handled.map((o) => o.actionId)).toEqual([1, 2]);
  });
});
