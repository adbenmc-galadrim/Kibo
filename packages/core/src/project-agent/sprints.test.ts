import { describe, expect, test } from "bun:test";
import type { ProposeBatchInput, ProposedAction, SprintView } from "@kibo/schema";
import { commandsFor, staleReason } from "./apply-plan";
import { captureExpected } from "./expected";
import { answered, HUMAN, project, question, questionContext, ticket } from "./test-kit";
import { type BatchContext, validateBatch } from "./validate";

const sprint = (id: string, code: string, start: string, end: string): SprintView => ({
  id,
  code,
  name: `Sprint ${code}`,
  start,
  end,
  state: "planned",
  features: [],
  delivered: 0,
  total: 0,
});

const snapshot = project({
  tickets: [
    ticket({ id: "t5", key: "EMIS-5", sprintId: "s42" }),
    ticket({ id: "t6", key: "EMIS-6", parentId: "t5" }),
    ticket({ id: "t9", key: "EMIS-9" }),
  ],
  sprints: [
    sprint("s42", "S42", "2026-10-12", "2026-10-16"),
    sprint("s43", "S43", "2026-10-19", "2026-10-23"),
  ],
  questions: [question({ id: "q14", ticketId: "t5" }), answered(question({ id: "q2", ticketId: "t5" }))],
});

const ctx = (p: Partial<BatchContext> = {}): BatchContext => questionContext({ project: snapshot, ...p });
const why = "";
const batch = (...actions: ProposedAction[]): ProposeBatchInput => ({ summary: "Report", actions });
const problems = (input: ProposeBatchInput, c = ctx()) => {
  const result = validateBatch(input, c);
  return result.ok ? [] : result.problems.map((p) => `#${p.actionId} ${p.message}`);
};

describe("sprint actions at validation", () => {
  test("setSprint targets a root ticket and a known sprint, or none", () => {
    expect(
      problems(
        batch(
          { id: 1, why, type: "setSprint", ticket: "EMIS-5", sprint: "s43" },
          { id: 2, why, type: "setSprint", ticket: "EMIS-9", sprint: null },
        ),
      ),
    ).toEqual([]);
    expect(problems(batch({ id: 1, why, type: "setSprint", ticket: "EMIS-6", sprint: "S43" }))).toEqual([
      "#1 sprint set on the root ticket",
    ]);
    expect(problems(batch({ id: 1, why, type: "setSprint", ticket: "EMIS-5", sprint: "S99" }))).toEqual([
      "#1 sprint inconnu « S99 » : crée-le plus tôt dans le lot par createSprint",
    ]);
  });

  test("a ticket created under a parent in the batch is not a root", () => {
    expect(
      problems(
        batch(
          { id: 1, why, type: "createTicket", ref: "new:1", title: "Étape", parent: "EMIS-5" },
          { id: 2, why, type: "setSprint", ticket: "new:1", sprint: "S43" },
        ),
      ),
    ).toEqual(["#2 sprint set on the root ticket"]);
  });

  test("a sprint created earlier in the batch can be targeted, not one created later", () => {
    const create: ProposedAction = {
      id: 1,
      why,
      type: "createSprint",
      code: "S45",
      name: "Clôture",
      start: "2026-11-02",
      end: "2026-11-06",
    };
    const move: ProposedAction = { id: 2, why, type: "setSprint", ticket: "EMIS-9", sprint: "S45" };
    expect(problems(batch(create, move))).toEqual([]);
    expect(problems(batch(move, { ...create, id: 3 }))).toEqual([
      "#2 sprint inconnu « S45 » : crée-le plus tôt dans le lot par createSprint",
    ]);
  });

  test("createSprint needs a free code and a start before its end", () => {
    const create = (id: number, code: string, start: string, end: string): ProposedAction => ({
      id,
      why,
      type: "createSprint",
      code,
      name: "Clôture",
      start,
      end,
    });
    expect(problems(batch(create(1, "s42", "2026-11-02", "2026-11-06")))).toEqual([
      "#1 code de sprint déjà pris « s42 »",
    ]);
    expect(
      problems(
        batch(create(1, "S45", "2026-11-02", "2026-11-06"), create(2, "S45", "2026-11-09", "2026-11-13")),
      ),
    ).toEqual(["#2 code de sprint déjà pris « S45 »"]);
    expect(problems(batch(create(1, "S45", "2026-11-06", "2026-11-02")))).toEqual([
      "#1 la fin du sprint précède son début",
    ]);
    expect(problems(batch(create(1, "S45", "2026-11-06", "2026-11-06")))).toEqual([]);
  });

  test("remindQuestion needs an open question, once", () => {
    expect(problems(batch({ id: 1, why, type: "remindQuestion", questionId: "q14" }))).toEqual([]);
    expect(problems(batch({ id: 1, why, type: "remindQuestion", questionId: "q2" }))).toEqual([
      "#1 question déjà répondue « q2 »",
    ]);
    expect(problems(batch({ id: 1, why, type: "remindQuestion", questionId: "q404" }))).toEqual([
      "#1 question inconnue « q404 »",
    ]);
    expect(
      problems(
        batch(
          { id: 1, why, type: "remindQuestion", questionId: "q14" },
          { id: 2, why, type: "remindQuestion", questionId: "q14" },
        ),
      ),
    ).toEqual(["#2 deux actions sur q14.reminded"]);
  });
});

describe("sprint actions: expected state and commands", () => {
  const move: ProposedAction = { id: 1, why, type: "setSprint", ticket: "EMIS-5", sprint: "S43" };

  test("setSprint captures the current sprint and goes stale when it changes", () => {
    const expected = { actionId: 1, fields: captureExpected(move, ctx()) };
    expect(expected.fields).toEqual({ sprintId: "s42" });
    const ids = { "EMIS-5": "t5" };
    expect(staleReason(move, expected, ctx(), ids)).toBeNull();
    const moved = project({
      ...snapshot,
      tickets: snapshot.tickets.map((t) => (t.id === "t5" ? { ...t, sprintId: "s43" } : t)),
    });
    expect(staleReason(move, expected, ctx({ project: moved }), ids)).toBe(
      "modifié depuis la proposition : sprintId",
    );
  });

  test("createSprint goes stale when its code is taken meanwhile, remindQuestion when answered", () => {
    const create: ProposedAction = {
      id: 2,
      why,
      type: "createSprint",
      code: "S45",
      name: "Clôture",
      start: "2026-11-02",
      end: "2026-11-06",
    };
    const remind: ProposedAction = { id: 3, why, type: "remindQuestion", questionId: "q14" };
    expect(captureExpected(create, ctx())).toEqual({ exists: false });
    expect(captureExpected(remind, ctx())).toEqual({ answered: false });
    const later = project({
      ...snapshot,
      sprints: [...snapshot.sprints, sprint("s45", "s45", "2026-11-02", "2026-11-06")],
      questions: snapshot.questions.map((q) => (q.id === "q14" ? answered(q) : q)),
    });
    expect(staleReason(create, { actionId: 2, fields: { exists: false } }, ctx({ project: later }), {})).toBe(
      "modifié depuis la proposition : exists",
    );
    expect(
      staleReason(remind, { actionId: 3, fields: { answered: false } }, ctx({ project: later }), {}),
    ).toBe("modifié depuis la proposition : answered");
  });

  test("commands: setTicketSprint by the sprint id of the code, createSprint, remindQuestion", () => {
    expect(commandsFor(move, { "EMIS-5": "t5" }, HUMAN, snapshot)).toEqual([
      { method: "setTicketSprint", ticketId: "t5", sprintId: "s43" },
    ]);
    expect(commandsFor({ ...move, sprint: null }, { "EMIS-5": "t5" }, HUMAN, snapshot)).toEqual([
      { method: "setTicketSprint", ticketId: "t5", sprintId: null },
    ]);
    expect(() => commandsFor({ ...move, sprint: "S99" }, { "EMIS-5": "t5" }, HUMAN, snapshot)).toThrow(
      "sprint S99 not found",
    );
    expect(
      commandsFor(
        {
          id: 2,
          why,
          type: "createSprint",
          code: "S45",
          name: "Clôture",
          start: "2026-11-02",
          end: "2026-11-06",
        },
        {},
        HUMAN,
        snapshot,
      ),
    ).toEqual([
      { method: "createSprint", code: "S45", name: "Clôture", start: "2026-11-02", end: "2026-11-06" },
    ]);
    expect(
      commandsFor({ id: 3, why, type: "remindQuestion", questionId: "q14" }, {}, HUMAN, snapshot),
    ).toEqual([{ method: "remindQuestion", questionId: "q14", by: HUMAN }]);
  });
});
