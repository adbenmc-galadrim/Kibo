import { describe, expect, test } from "bun:test";
import { KiboError, type ProposedAction } from "@kibo/schema";
import { commandsFor, staleReason } from "./apply-plan";
import { captureExpected } from "./expected";
import { HUMAN, questionContext, questionSnapshot } from "./test-kit";

const why = "";
const ctx = questionContext();
const capture = (action: ProposedAction) => captureExpected(action, ctx);
const ids = { "SILO-2": "t2" };
const commands = (action: ProposedAction) => commandsFor(action, ids, HUMAN, ctx.project);

describe("expected state of question actions", () => {
  test("an update expects the fields it changes and the delivery", () => {
    expect(
      capture({ id: 1, why, type: "updateQuestion", questionId: "q1", title: "B", recipient: "Client" }),
    ).toEqual({ title: "A", recipient: "me", delivered: false });
    expect(capture({ id: 1, why, type: "updateQuestion", questionId: "q3", ticket: "SILO-2" })).toEqual({
      ticketId: "t1",
      delivered: true,
    });
  });

  test("reopen, delete and addRecipient", () => {
    expect(capture({ id: 1, why, type: "reopenQuestion", questionId: "q2" })).toEqual({ answerAt: 1 });
    expect(capture({ id: 1, why, type: "deleteQuestion", questionId: "q1" })).toEqual({
      archived: false,
      answerAt: null,
    });
    expect(capture({ id: 1, why, type: "addRecipient", name: "Galadrim" })).toEqual({ exists: false });
    expect(capture({ id: 1, why, type: "addRecipient", name: "client" })).toEqual({ exists: true });
  });

  test("an answered question expects to stay open and not archived", () => {
    expect(
      capture({ id: 1, why, type: "answerQuestion", questionId: "q4", answer: { kind: "confirm" } }),
    ).toEqual({
      answered: true,
    });
  });

  test("a title changed since the proposal makes the update stale", () => {
    const action: ProposedAction = { id: 1, why, type: "updateQuestion", questionId: "q1", title: "B" };
    const expected = { actionId: 1, fields: capture(action) };
    const renamed = questionSnapshot().questions.map((q) => (q.id === "q1" ? { ...q, title: "Autre" } : q));
    const later = questionContext({ project: { ...questionSnapshot(), questions: renamed } });
    expect(staleReason(action, expected, later, {})).toBe("modifié depuis la proposition : title");
    expect(staleReason(action, expected, ctx, {})).toBeNull();
  });
});

describe("commandsFor question actions", () => {
  test("an update resolves its ticket and recipient", () => {
    expect(
      commands({
        id: 1,
        why,
        type: "updateQuestion",
        questionId: "q1",
        ticket: "SILO-2",
        recipient: "Client",
      }),
    ).toEqual([
      { method: "updateQuestion", questionId: "q1", ticketId: "t2", recipient: "client", by: HUMAN },
    ]);
  });

  test("an unknown recipient at application fails with NOT_FOUND", () => {
    const run = () =>
      commands({ id: 1, why, type: "updateQuestion", questionId: "q1", recipient: "Galadrim" });
    expect(run).toThrow(KiboError);
    expect(run).toThrow(
      expect.objectContaining({ code: "NOT_FOUND", detail: "destinataire inconnu « Galadrim »" }),
    );
  });

  test("reopen, archive and add a recipient", () => {
    expect(commands({ id: 1, why, type: "reopenQuestion", questionId: "q2" })).toEqual([
      { method: "reopenQuestion", questionId: "q2", by: HUMAN },
    ]);
    expect(commands({ id: 1, why, type: "deleteQuestion", questionId: "q1" })).toEqual([
      { method: "archiveQuestion", questionId: "q1", by: HUMAN },
    ]);
    expect(commands({ id: 1, why, type: "addRecipient", name: "Galadrim" })).toEqual([
      { method: "addQuestionRecipient", name: "Galadrim" },
    ]);
  });

  test("a created question carries its recipient id", () => {
    const [command] = commands({
      id: 1,
      why,
      type: "createQuestion",
      ticket: "SILO-2",
      title: "Q",
      recipient: "Produit",
    });
    expect(command).toMatchObject({ method: "createQuestion", ticketId: "t2", recipient: "product" });
  });
});
