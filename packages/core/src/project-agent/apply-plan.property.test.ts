import { describe, expect, test } from "bun:test";
import { isTerminal, type ProposedAction, RunState, StatusId } from "@kibo/schema";
import fc from "fast-check";
import { commandsFor, isSkipped, resolveRefs, staleReason } from "./apply-plan";
import { answered, HUMAN, PROFILES, project, question, run, ticket } from "./test-kit";
import { type BatchContext, captureExpected, validateBatch } from "./validate";

const base: BatchContext = {
  project: project({
    tickets: [
      ticket({ id: "t1", title: "Un", description: "d1", labels: ["ui"] }),
      ticket({ id: "t2", title: "Deux", description: "d2", parentId: "t1" }),
      ticket({ id: "t3", title: "Trois" }),
    ],
    questions: [question({ id: "q1", ticketId: "t1" }), answered(question({ id: "q2", ticketId: "t3" }))],
  }),
  runs: [run({ id: "r1", ticketId: "t2", state: "running" })],
  notes: [{ path: "a.md", hash: "h1" }],
  profiles: PROFILES,
  demoProject: false,
  viewer: "adam",
};

const why = "";
const ACTIONS: ProposedAction[] = [
  { id: 1, why, type: "updateTicket", ticket: "EMIS-1", title: "Nouveau", labels: [] },
  { id: 2, why, type: "updateTicket", ticket: "EMIS-2", description: "d", parent: "EMIS-3" },
  { id: 3, why, type: "setStatus", ticket: "EMIS-1", statusId: "done" },
  { id: 4, why, type: "answerQuestion", questionId: "q1", answer: { kind: "text", text: "oui" } },
  { id: 5, why, type: "updateNote", path: "a.md", content: "x" },
  { id: 6, why, type: "createNote", path: "b.md", content: "x" },
  { id: 7, why, type: "cancelRun", runId: "r1" },
  { id: 8, why, type: "deliverAnswers", ticket: "EMIS-3" },
  { id: 9, why, type: "assignAgent", ticket: "EMIS-3", profileId: "opus" },
  { id: 10, why, type: "link", from: "EMIS-1", to: "EMIS-3", kind: "blocks" },
];

const mutation = fc.record({
  t1Title: fc.constantFrom("Un", "Autre"),
  t1Description: fc.constantFrom("d1", "autre"),
  t1Labels: fc.constantFrom(["ui"], ["api"], []),
  t1Status: fc.constantFrom(...StatusId.options.filter((s) => s !== "blocked")),
  t2Description: fc.constantFrom("d2", "autre"),
  t2Parent: fc.constantFrom("t1", "t3", null),
  q1Answered: fc.boolean(),
  noteA: fc.constantFrom("h1", "h2", null),
  noteB: fc.boolean(),
  r1State: fc.constantFrom(...RunState.options),
  extraAnswer: fc.boolean(),
  t3Run: fc.option(fc.constantFrom(...RunState.options), { nil: null }),
});
type Mutation = typeof mutation extends fc.Arbitrary<infer M> ? M : never;

function mutate(m: Mutation): BatchContext {
  const tickets = base.project.tickets.map((t) => {
    if (t.id === "t1")
      return {
        ...t,
        title: m.t1Title,
        description: m.t1Description,
        labels: [...m.t1Labels],
        statusId: m.t1Status,
      };
    if (t.id === "t2") return { ...t, description: m.t2Description, parentId: m.t2Parent };
    return t;
  });
  const questions = [
    ...base.project.questions.map((q) => (q.id === "q1" && m.q1Answered ? answered(q) : q)),
    ...(m.extraAnswer ? [answered(question({ id: "q3", ticketId: "t3" }))] : []),
  ];
  return {
    ...base,
    project: { ...base.project, tickets, questions },
    runs: [
      run({ id: "r1", ticketId: "t2", state: m.r1State }),
      ...(m.t3Run === null ? [] : [run({ id: "r9", ticketId: "t3", state: m.t3Run })]),
    ],
    notes: [
      ...(m.noteA === null ? [] : [{ path: "a.md", hash: m.noteA }]),
      ...(m.noteB ? [{ path: "b.md", hash: "hb" }] : []),
    ],
  };
}

function changed(id: number, m: Mutation): boolean {
  switch (id) {
    case 1:
      return m.t1Title !== "Un" || m.t1Labels.join() !== "ui";
    case 2:
      return m.t2Description !== "d2" || m.t2Parent !== "t1";
    case 3:
      return m.t1Status !== "todo";
    case 4:
      return m.q1Answered;
    case 5:
      return m.noteA !== "h1";
    case 6:
      return m.noteB;
    case 7:
      return isTerminal(m.r1State);
    case 8:
      return m.extraAnswer;
    case 9:
      return m.t3Run !== null && !isTerminal(m.t3Run);
    default:
      return false;
  }
}

describe("apply plan properties", () => {
  test("the proposal fixture is a valid batch", () => {
    expect(validateBatch({ summary: "Lot", actions: ACTIONS }, base).ok).toBe(true);
  });

  test("an action is stale if and only if a captured field changed", () => {
    fc.assert(
      fc.property(mutation, fc.constantFrom(...ACTIONS), (m, action) => {
        const expected = { actionId: action.id, fields: captureExpected(action, base) };
        const now = mutate(m);
        const resolved = resolveRefs(action, new Map(), now.project);
        if (!resolved.ok) return false;
        return (staleReason(action, expected, now, resolved.ids) !== null) === changed(action.id, m);
      }),
      { numRuns: 1_000 },
    );
  });

  test("an unchecked action produces no command", () => {
    const ids = { "EMIS-1": "t1", "EMIS-2": "t2", "EMIS-3": "t3" };
    const plan = (chosen: ReadonlySet<number>) =>
      ACTIONS.filter((a) => !isSkipped(a, chosen)).flatMap((a) => commandsFor(a, ids, HUMAN, base.project));
    fc.assert(
      fc.property(fc.subarray(ACTIONS.map((a) => a.id)), (chosen) => {
        const commands = plan(new Set(chosen));
        const expected = ACTIONS.filter((a) => chosen.includes(a.id)).flatMap((a) =>
          commandsFor(a, ids, HUMAN, base.project),
        );
        expect(commands).toEqual(expected);
        if (chosen.length === 0) expect(commands).toEqual([]);
      }),
    );
  });
});
