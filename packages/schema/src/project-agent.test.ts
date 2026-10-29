import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { batchStatusOfResults, foldBatch, isDecidable } from "./batch-fold";
import {
  ACTION_GROUPS,
  type ActionResult,
  type BatchRow,
  ProposeBatchInput,
  ProposedAction,
  TicketRef,
} from "./project-agent";
import { TicketPrintSchema } from "./project-agent-fingerprint";
import { TOOL_SPECS } from "./project-agent-tool-specs";

const HUMAN = { kind: "human" as const, ref: "adam" };
const OUTCOMES = ["applied", "stale", "failed", "skipped"] as const;
const one = { id: 1, why: "", type: "deliverAnswers", ticket: "SILO-1" };
const row: BatchRow = {
  id: "b1",
  projectId: "p1",
  runId: "r1",
  sessionId: "s1",
  seq: 1,
  summary: "Ranger le backlog",
  actions: [
    { id: 1, why: "", type: "setStatus", ticket: "SILO-1", statusId: "done" },
    { id: 2, why: "", type: "setStatus", ticket: "SILO-2", statusId: "todo" },
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
        ticket: "SILO-11",
        statusId: "in_review",
      }).success,
    ).toBe(true);
    expect(
      ProposedAction.safeParse({ id: 1, why: "x".repeat(301), type: "deliverAnswers", ticket: "new:1" })
        .success,
    ).toBe(false);
    expect(ProposedAction.safeParse({ id: 0, why: "", type: "cancelRun", runId: "r1" }).success).toBe(false);
    expect(TicketRef.safeParse("new:0").success).toBe(false);
    expect(TicketRef.safeParse("silo-11").success).toBe(false);
    expect(
      ProposedAction.safeParse({ id: 2, why: "", type: "createNote", path: "../x.md", content: "" }).success,
    ).toBe(false);
    expect(
      ProposedAction.safeParse({ id: 2, why: "", type: "link", from: "SILO-1", to: "new:1", kind: "relates" })
        .success,
    ).toBe(false);
    expect(
      ProposedAction.safeParse({
        id: 2,
        why: "",
        type: "unlink",
        from: "SILO-1",
        to: "SILO-2",
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

describe("signals in a batch", () => {
  test("an action may cite up to twenty signals", () => {
    const create = { id: 1, why: "", type: "createTicket", ref: "new:1", title: "T", signals: ["sig:1"] };
    expect(ProposedAction.parse(create)).toMatchObject({ signals: ["sig:1"] });
    const many = Array.from({ length: 21 }, (_, i) => `sig:${i + 1}`);
    expect(ProposedAction.safeParse({ ...create, signals: many }).success).toBe(false);
    expect(ProposedAction.safeParse({ ...create, signals: ["sig:0"] }).success).toBe(false);
  });

  test("dismissSignal closes a signal in the signals group", () => {
    const dismiss = { id: 2, why: "sans suite", type: "dismissSignal", signal: "sig:3" } as const;
    expect(ProposedAction.parse(dismiss)).toEqual(dismiss);
    expect(ProposedAction.safeParse({ ...dismiss, signal: "3" }).success).toBe(false);
    expect(ACTION_GROUPS.dismissSignal).toBe("signals");
  });
});

describe("question actions in a batch", () => {
  const qid = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
  const update = { id: 1, why: "", type: "updateQuestion", questionId: qid, title: "B" } as const;

  test("updateQuestion never changes blocking and leaves an empty update to the batch validation", () => {
    expect(ProposedAction.parse(update)).toEqual(update);
    const empty = { id: 1, why: "", type: "updateQuestion", questionId: qid } as const;
    expect(ProposeBatchInput.parse({ summary: "s", actions: [empty] }).actions).toEqual([empty]);
    expect(ProposedAction.safeParse({ ...update, blocking: true }).success).toBe(false);
    expect(ProposedAction.parse({ ...update, recipient: "Client", ticket: "SILO-2" })).toMatchObject({
      recipient: "Client",
      ticket: "SILO-2",
    });
  });

  test("reopenQuestion, deleteQuestion and addRecipient", () => {
    expect(
      ProposedAction.safeParse({ id: 2, why: "", type: "reopenQuestion", questionId: qid }).success,
    ).toBe(true);
    expect(
      ProposedAction.safeParse({ id: 3, why: "", type: "deleteQuestion", questionId: qid }).success,
    ).toBe(true);
    const add = { id: 4, why: "", type: "addRecipient", name: "Galadrim" } as const;
    expect(ProposedAction.parse(add)).toEqual(add);
    expect(ProposedAction.safeParse({ ...add, name: "x".repeat(41) }).success).toBe(false);
  });

  test("createQuestion may name its recipient", () => {
    const create = {
      id: 5,
      why: "",
      type: "createQuestion",
      ticket: "SILO-1",
      title: "Q",
      recipient: "Client",
    };
    expect(ProposedAction.parse(create)).toMatchObject({ recipient: "Client" });
  });

  test("setSprint moves a feature to a sprint code or out of the planning", () => {
    const set = { id: 1, why: "fin de S42", type: "setSprint", ticket: "SILO-30", sprint: "S43" } as const;
    expect(ProposedAction.parse(set)).toEqual(set);
    expect(ProposedAction.parse({ ...set, sprint: null })).toMatchObject({ sprint: null });
    expect(ProposedAction.safeParse({ ...set, sprint: "S123456789" }).success).toBe(false);
    expect(ProposedAction.safeParse({ ...set, ticket: "f5" }).success).toBe(false);
  });

  test("createSprint carries a code, a name and two dates", () => {
    const create = {
      id: 2,
      why: "",
      type: "createSprint",
      code: "S45",
      name: "Clôture",
      start: "2026-11-02",
      end: "2026-11-06",
    } as const;
    expect(ProposedAction.parse(create)).toEqual(create);
    expect(ProposedAction.safeParse({ ...create, start: "2 nov." }).success).toBe(false);
  });

  test("remindQuestion names an open question, in the questions group", () => {
    expect(
      ProposedAction.safeParse({ id: 3, why: "", type: "remindQuestion", questionId: qid }).success,
    ).toBe(true);
    expect(ACTION_GROUPS.remindQuestion).toBe("questions");
    expect(ACTION_GROUPS.setSprint).toBe("sprints");
    expect(ACTION_GROUPS.createSprint).toBe("sprints");
  });

  test("the four question actions belong to the questions group", () => {
    for (const type of ["updateQuestion", "reopenQuestion", "deleteQuestion", "addRecipient"] as const) {
      expect(ACTION_GROUPS[type]).toBe("questions");
    }
  });
});

describe("holds in a batch", () => {
  test("setHold puts a step on hold or resumes it, in the tickets group", () => {
    const hold = {
      id: 1,
      why: "recette indisponible",
      type: "setHold",
      ticket: "SILO-33",
      reason: "R",
    } as const;
    expect(ProposedAction.parse(hold)).toEqual(hold);
    expect(ProposedAction.parse({ ...hold, reason: null })).toMatchObject({ reason: null });
    expect(ProposedAction.safeParse({ ...hold, reason: "x".repeat(81) }).success).toBe(false);
    expect(ProposedAction.safeParse({ ...hold, reason: "" }).success).toBe(false);
    expect(ACTION_GROUPS.setHold).toBe("tickets");
  });

  test("the ticket print sees the hold, and the batch tool documents its reason", () => {
    const print = { key: "SILO-33", title: "T", statusId: "todo", labels: [], parentId: "f5" };
    const base = { ...print, assignee: null, branch: null, pr: null };
    expect(TicketPrintSchema.parse(base).hold).toBeNull();
    const hold = { reason: "R", since: "2026-10-16" };
    expect(TicketPrintSchema.parse({ ...base, hold }).hold).toEqual(hold);
    const batch = TOOL_SPECS.find((s) => s.name === "propose_batch");
    expect(JSON.stringify(batch?.inputSchema)).toContain('"reason":{"type":["string","null"],"maxLength":80');
    expect(TOOL_SPECS.find((s) => s.name === "list_tickets")?.description).toContain("en attente (hold)");
  });

  test("the batch tool lets createTicket make a feature", () => {
    const batch = TOOL_SPECS.find((s) => s.name === "propose_batch");
    expect(JSON.stringify(batch?.inputSchema)).toContain('"feature":{"type":"boolean"');
  });
});
