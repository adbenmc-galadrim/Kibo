import { describe, expect, test } from "bun:test";
import type { ProposeBatchInput, ProposedAction } from "@kibo/schema";
import { commandsFor, staleReason } from "./apply-plan";
import { captureExpected } from "./expected";
import { ticketRefsOf } from "./refs";
import { HUMAN, project, questionContext, ticket } from "./test-kit";
import { type BatchContext, validateBatch } from "./validate";

const MINIO = { reason: "Serveur MinIO de recette indisponible", since: "2026-10-16" };
const snapshot = project({
  tickets: [
    ticket({ id: "t30", key: "SILO-30" }),
    ticket({ id: "t33", key: "SILO-33", parentId: "t30", statusId: "in_progress" }),
    ticket({ id: "t31", key: "SILO-31", parentId: "t30", statusId: "done", hold: MINIO }),
  ],
});
const ctx = (p: Partial<BatchContext> = {}): BatchContext => questionContext({ project: snapshot, ...p });
const why = "";
const hold = (id: number, ticketRef: string, reason: string | null): ProposedAction => ({
  id,
  why,
  type: "setHold",
  ticket: ticketRef,
  reason,
});
const batch = (...actions: ProposedAction[]): ProposeBatchInput => ({ summary: "Attente", actions });
const problems = (input: ProposeBatchInput, c = ctx()) => {
  const result = validateBatch(input, c);
  return result.ok ? [] : result.problems.map((p) => `#${p.actionId} ${p.message}`);
};

describe("setHold at validation", () => {
  test("a step is put on hold or resumed", () => {
    expect(problems(batch(hold(1, "SILO-33", MINIO.reason)))).toEqual([]);
    expect(problems(batch(hold(1, "SILO-31", null)))).toEqual([]);
  });

  test("a feature is never put on hold, nor a delivered step", () => {
    expect(problems(batch(hold(1, "SILO-30", "R")))).toEqual(["#1 hold set on a step, not a feature"]);
    expect(problems(batch(hold(1, "SILO-31", "R")))).toEqual(["#1 a delivered step cannot be held"]);
  });

  test("a step created earlier in the batch can be put on hold", () => {
    const create: ProposedAction = {
      id: 1,
      why,
      type: "createTicket",
      ref: "new:1",
      title: "É",
      parent: "SILO-30",
    };
    expect(problems(batch(create, hold(2, "new:1", "R")))).toEqual([]);
  });

  test("two holds on the same step are refused", () => {
    expect(problems(batch(hold(1, "SILO-33", "R"), hold(2, "SILO-33", null)))).toEqual([
      "#2 deux actions sur SILO-33.hold",
    ]);
  });
});

describe("setHold when applied", () => {
  test("the expected state is the hold of the step, stale once it changed", () => {
    const action = hold(1, "SILO-33", "R");
    const fields = captureExpected(action, ctx());
    expect(fields).toEqual({ hold: null });
    const ids = { "SILO-33": "t33" };
    expect(staleReason(action, { actionId: 1, fields }, ctx(), ids)).toBeNull();
    const moved = project({
      tickets: snapshot.tickets.map((t) => (t.id === "t33" ? { ...t, hold: MINIO } : t)),
    });
    expect(staleReason(action, { actionId: 1, fields }, ctx({ project: moved }), ids)).toBe(
      "modifié depuis la proposition : hold",
    );
  });

  test("the command carries no day, the daemon stamps it", () => {
    expect(ticketRefsOf(hold(1, "SILO-33", "R"))).toEqual(["SILO-33"]);
    expect(commandsFor(hold(1, "SILO-33", "R"), { "SILO-33": "t33" }, HUMAN, snapshot)).toEqual([
      { method: "setHold", ticketId: "t33", reason: "R" },
    ]);
    expect(commandsFor(hold(1, "SILO-31", null), { "SILO-31": "t31" }, HUMAN, snapshot)).toEqual([
      { method: "setHold", ticketId: "t31", reason: null },
    ]);
  });
});
