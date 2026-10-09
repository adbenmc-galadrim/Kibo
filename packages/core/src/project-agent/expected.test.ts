import { describe, expect, test } from "bun:test";
import type { ProposeBatchInput, ProposedAction } from "@kibo/schema";
import { answered, link, PROFILES, project, question, run, ticket } from "./test-kit";
import {
  type BatchContext,
  captureExpected,
  registeredText,
  renderProblems,
  validateBatch,
} from "./validate";

const snapshot = project({
  tickets: [
    ticket({ id: "t1", title: "Un", statusId: "in_progress", description: "d1", labels: ["ui"] }),
    ticket({ id: "t2", title: "Deux", parentId: "t1" }),
    ticket({ id: "t3", title: "Trois" }),
  ],
  links: [link("l1", "t1", "t2"), link("l2", "t2", "t3", "relates")],
  questions: [
    question({ id: "q1", ticketId: "t1", options: ["A", "B"], provisional: "A" }),
    answered(question({ id: "q2", ticketId: "t3" })),
  ],
});

const ctx = (p: Partial<BatchContext> = {}): BatchContext => ({
  project: snapshot,
  runs: [
    run({ id: "r1", ticketId: "t2", state: "running" }),
    run({ id: "r2", ticketId: "t3", state: "done" }),
    run({ id: "r3", projectId: "other", ticketId: "x", state: "running" }),
  ],
  notes: [{ path: "a.md", hash: "h1" }],
  profiles: PROFILES,
  demoProject: false,
  viewer: "adam",
  ...p,
});

const batch = (...actions: ProposedAction[]): ProposeBatchInput => ({ summary: "Lot", actions });
const why = "";

describe("captureExpected", () => {
  test("captures exactly the fields the action depends on", () => {
    const c = ctx();
    const capture = (action: ProposedAction) => captureExpected(action, c);
    expect(capture({ id: 1, why, type: "updateTicket", ticket: "EMIS-1", title: "x", labels: [] })).toEqual({
      title: "Un",
      labels: ["ui"],
    });
    expect(
      capture({ id: 1, why, type: "updateTicket", ticket: "EMIS-2", description: "x", parent: null }),
    ).toEqual({
      description: "",
      parentId: "t1",
    });
    expect(capture({ id: 1, why, type: "updateTicket", ticket: "new:1", title: "x" })).toEqual({});
    expect(capture({ id: 1, why, type: "setStatus", ticket: "EMIS-1", statusId: "done" })).toEqual({
      statusId: "in_progress",
    });
    expect(
      capture({ id: 1, why, type: "answerQuestion", questionId: "q1", answer: { kind: "confirm" } }),
    ).toEqual({
      answered: false,
    });
    expect(capture({ id: 1, why, type: "updateNote", path: "a.md", content: "" })).toEqual({ hash: "h1" });
    expect(capture({ id: 1, why, type: "createNote", path: "b.md", content: "" })).toEqual({ exists: false });
    expect(capture({ id: 1, why, type: "cancelRun", runId: "r1" })).toEqual({ terminal: false });
    expect(capture({ id: 1, why, type: "deliverAnswers", ticket: "EMIS-3" })).toEqual({
      undelivered: ["q2"],
    });
    expect(capture({ id: 1, why, type: "assignAgent", ticket: "EMIS-2", profileId: "opus" })).toEqual({
      activeRun: "r1",
    });
    expect(capture({ id: 1, why, type: "link", from: "EMIS-1", to: "EMIS-3", kind: "blocks" })).toEqual({});
    expect(capture({ id: 1, why, type: "createTicket", ref: "new:1", title: "x" })).toEqual({});
  });

  test("a valid batch carries one expected state per action", () => {
    const result = validateBatch(
      batch(
        { id: 1, why, type: "setStatus", ticket: "EMIS-1", statusId: "done" },
        { id: 2, why, type: "createNote", path: "b.md", content: "" },
      ),
      ctx(),
    );
    expect(result).toEqual({
      ok: true,
      batch: {
        actions: [
          { id: 1, why, type: "setStatus", ticket: "EMIS-1", statusId: "done" },
          { id: 2, why, type: "createNote", path: "b.md", content: "" },
        ],
        expected: [
          { actionId: 1, fields: { statusId: "in_progress" } },
          { actionId: 2, fields: { exists: false } },
        ],
      },
    });
  });
});

describe("texts", () => {
  test("problems are rendered one per line with the action type", () => {
    expect(
      renderProblems([
        { actionId: 2, type: "setStatus", message: "statut inconnu « nope »" },
        { actionId: 3, type: "createNote", message: "note déjà existante « a.md »" },
      ]),
    ).toBe("#2 setStatus : statut inconnu « nope »\n#3 createNote : note déjà existante « a.md »");
  });

  test("the registered text names the batch and who validates it", () => {
    expect(registeredText({ seq: 3 }, "adam")).toBe("Lot 3 enregistré, en attente de validation d'adam.");
    expect(registeredText({ seq: 4 }, "lea")).toBe("Lot 4 enregistré, en attente de validation de lea.");
  });
});
