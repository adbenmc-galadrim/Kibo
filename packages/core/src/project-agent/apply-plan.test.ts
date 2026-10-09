import { describe, expect, test } from "bun:test";
import { KiboError, type ProposedAction } from "@kibo/schema";
import { commandsFor, isSkipped, type RefTable, resolveRefs, staleReason } from "./apply-plan";
import { answered, HUMAN, link, PROFILES, project, question, run, ticket } from "./test-kit";
import type { BatchContext } from "./validate";
import { captureExpected } from "./validate";

const snapshot = project({
  tickets: [
    ticket({ id: "t1", title: "Un", description: "d1", statusId: "in_progress" }),
    ticket({ id: "t2", title: "Deux", parentId: "t1" }),
    ticket({ id: "t3", title: "Trois" }),
  ],
  links: [link("l1", "t1", "t2"), link("l2", "t2", "t3", "relates")],
  questions: [question({ id: "q1", ticketId: "t1" }), answered(question({ id: "q2", ticketId: "t3" }))],
});

const ctx = (p: Partial<BatchContext> = {}): BatchContext => ({
  project: snapshot,
  runs: [run({ id: "r1", ticketId: "t2", state: "running" })],
  notes: [{ path: "a.md", hash: "h1" }],
  profiles: PROFILES,
  demoProject: false,
  viewer: "adam",
  ...p,
});

const why = "";
const created: RefTable = new Map([["new:1", { ticketId: "t9", key: "EMIS-9" }]]);

describe("resolveRefs", () => {
  test("keys and created references resolve to ticket ids", () => {
    expect(
      resolveRefs(
        { id: 1, why, type: "link", from: "EMIS-1", to: "new:1", kind: "blocks" },
        created,
        snapshot,
      ),
    ).toEqual({ ok: true, ids: { "EMIS-1": "t1", "new:1": "t9" } });
    expect(
      resolveRefs({ id: 1, why, type: "createNote", path: "a.md", content: "" }, created, snapshot),
    ).toEqual({
      ok: true,
      ids: {},
    });
  });

  test("a failed reference or a vanished ticket cannot resolve", () => {
    expect(
      resolveRefs({ id: 1, why, type: "setStatus", ticket: "new:2", statusId: "todo" }, created, snapshot),
    ).toEqual({ ok: false, reason: "dépend de new:2 (échouée)" });
    expect(
      resolveRefs({ id: 1, why, type: "setStatus", ticket: "EMIS-9", statusId: "todo" }, new Map(), snapshot),
    ).toEqual({ ok: false, reason: "ticket EMIS-9 introuvable" });
  });
});

const withTicket = (id: string, patch: Parameters<typeof ticket>[0]) => ({
  ...snapshot,
  tickets: snapshot.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
});

function stale(action: ProposedAction, after: Partial<BatchContext>): string | null {
  const before = ctx();
  const expected = { actionId: action.id, fields: captureExpected(action, before) };
  const now = ctx(after);
  const resolved = resolveRefs(action, new Map(), now.project);
  if (!resolved.ok) throw new Error(resolved.reason);
  return staleReason(action, expected, now, resolved.ids);
}

describe("staleReason", () => {
  test("a ticket field changed since the proposal is stale, another field is not", () => {
    const rename: ProposedAction = { id: 1, why, type: "updateTicket", ticket: "EMIS-1", title: "Nouveau" };
    expect(stale(rename, { project: withTicket("t1", { id: "t1", title: "Autre" }) })).toBe(
      "modifié depuis la proposition : title",
    );
    expect(stale(rename, { project: withTicket("t1", { id: "t1", description: "autre" }) })).toBeNull();
  });

  test("status, question, note, run and answers", () => {
    expect(
      stale(
        { id: 1, why, type: "setStatus", ticket: "EMIS-1", statusId: "done" },
        { project: withTicket("t1", { id: "t1", statusId: "in_review" }) },
      ),
    ).toBe("modifié depuis la proposition : statusId");
    expect(
      stale(
        { id: 1, why, type: "answerQuestion", questionId: "q1", answer: { kind: "text", text: "x" } },
        {
          project: {
            ...snapshot,
            questions: snapshot.questions.map((q) => (q.id === "q1" ? answered(q) : q)),
          },
        },
      ),
    ).toBe("modifié depuis la proposition : answered");
    expect(
      stale(
        { id: 1, why, type: "updateNote", path: "a.md", content: "" },
        { notes: [{ path: "a.md", hash: "h2" }] },
      ),
    ).toBe("modifié depuis la proposition : hash");
    expect(
      stale(
        { id: 1, why, type: "createNote", path: "b.md", content: "" },
        { notes: [{ path: "b.md", hash: "x" }] },
      ),
    ).toBe("modifié depuis la proposition : exists");
    expect(
      stale(
        { id: 1, why, type: "cancelRun", runId: "r1" },
        { runs: [run({ id: "r1", ticketId: "t2", state: "done" })] },
      ),
    ).toBe("modifié depuis la proposition : terminal");
    expect(
      stale(
        { id: 1, why, type: "deliverAnswers", ticket: "EMIS-3" },
        {
          project: {
            ...snapshot,
            questions: [...snapshot.questions, answered(question({ id: "q3", ticketId: "t3" }))],
          },
        },
      ),
    ).toBe("modifié depuis la proposition : undelivered");
    expect(
      stale(
        { id: 1, why, type: "assignAgent", ticket: "EMIS-3", profileId: "opus" },
        { runs: [run({ id: "r7", ticketId: "t3", state: "queued" })] },
      ),
    ).toBe("modifié depuis la proposition : activeRun");
  });

  test("nothing changed: not stale", () => {
    expect(stale({ id: 1, why, type: "setStatus", ticket: "EMIS-1", statusId: "done" }, {})).toBeNull();
    expect(stale({ id: 1, why, type: "link", from: "EMIS-1", to: "EMIS-3", kind: "blocks" }, {})).toBeNull();
  });
});

const ids = { "EMIS-1": "t1", "EMIS-2": "t2", "EMIS-3": "t3", "new:1": "t9" };
const commands = (action: ProposedAction) => commandsFor(action, ids, HUMAN, snapshot);

describe("commandsFor", () => {
  test("tickets", () => {
    expect(
      commands({
        id: 1,
        why,
        type: "createTicket",
        ref: "new:1",
        title: "Neuf",
        statusId: "todo",
        parent: "EMIS-1",
      }),
    ).toEqual([{ method: "createTicket", title: "Neuf", statusId: "todo", parentId: "t1" }]);
    expect(
      commands({ id: 1, why, type: "updateTicket", ticket: "EMIS-1", title: "T", labels: ["ui"] }),
    ).toEqual([{ method: "updateTicket", ticketId: "t1", title: "T", labels: ["ui"] }]);
    expect(
      commands({ id: 1, why, type: "updateTicket", ticket: "EMIS-2", description: "d", parent: "EMIS-3" }),
    ).toEqual([
      { method: "updateTicket", ticketId: "t2", description: "d" },
      { method: "moveTicket", ticketId: "t2", parentId: "t3" },
    ]);
    expect(commands({ id: 1, why, type: "updateTicket", ticket: "EMIS-2", parent: "EMIS-1" })).toEqual([]);
    expect(commands({ id: 1, why, type: "updateTicket", ticket: "EMIS-2", parent: null })).toEqual([
      { method: "moveTicket", ticketId: "t2", parentId: null },
    ]);
    expect(
      commands({
        id: 1,
        why,
        type: "setStatus",
        ticket: "new:1",
        statusId: "blocked",
        blockedReason: "attente",
      }),
    ).toEqual([{ method: "setStatus", ticketId: "t9", statusId: "blocked", reason: "attente" }]);
  });

  test("links", () => {
    expect(commands({ id: 1, why, type: "link", from: "EMIS-1", to: "new:1", kind: "blocks" })).toEqual([
      { method: "addLink", from: "t1", to: "t9", type: "blocks" },
    ]);
    expect(commands({ id: 1, why, type: "unlink", from: "EMIS-3", to: "EMIS-2", kind: "relates" })).toEqual([
      { method: "removeLink", linkId: "l2" },
    ]);
    expect(() =>
      commands({ id: 1, why, type: "unlink", from: "EMIS-2", to: "EMIS-1", kind: "blocks" }),
    ).toThrow(KiboError);
  });

  test("questions carry the human actor, never a run", () => {
    expect(
      commands({
        id: 1,
        why,
        type: "answerQuestion",
        questionId: "q1",
        answer: { kind: "text", text: "oui" },
      }),
    ).toEqual([
      { method: "answerQuestion", questionId: "q1", answer: { kind: "text", text: "oui" }, by: HUMAN },
    ]);
    expect(
      commands({
        id: 1,
        why,
        type: "createQuestion",
        ticket: "EMIS-1",
        title: "?",
        options: ["A"],
        blocking: true,
      }),
    ).toEqual([
      {
        method: "createQuestion",
        ticketId: "t1",
        title: "?",
        options: ["A"],
        blocking: true,
        createdBy: HUMAN,
        runId: null,
      },
    ]);
  });

  test("agents and notes are run by the daemon", () => {
    for (const action of [
      { id: 1, why, type: "assignAgent", ticket: "EMIS-1", profileId: "opus" },
      { id: 1, why, type: "deliverAnswers", ticket: "EMIS-3" },
      { id: 1, why, type: "cancelRun", runId: "r1" },
      { id: 1, why, type: "createNote", path: "b.md", content: "" },
      { id: 1, why, type: "updateNote", path: "a.md", content: "" },
    ] satisfies ProposedAction[]) {
      expect(commands(action)).toEqual([]);
    }
  });
});

test("isSkipped is true for unchecked actions", () => {
  const action: ProposedAction = { id: 2, why, type: "cancelRun", runId: "r1" };
  expect(isSkipped(action, new Set([1, 3]))).toBe(true);
  expect(isSkipped(action, new Set([2]))).toBe(false);
});
