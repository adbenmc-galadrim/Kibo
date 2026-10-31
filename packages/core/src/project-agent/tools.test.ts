import { describe, expect, test } from "bun:test";
import { answered, project, question, run, ticket } from "./test-kit";
import { compactJson, listQuestions, listRuns, listTickets, pageOf } from "./tools";

describe("pageOf", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);

  test("pages by 50 with a decimal cursor", () => {
    expect(pageOf(items, undefined)).toMatchObject({ nextCursor: "50", total: 120 });
    expect(pageOf(items, undefined).items).toHaveLength(50);
    expect(pageOf(items, "100")).toEqual({ items: items.slice(100), nextCursor: null, total: 120 });
    expect(pageOf(items, "500")).toEqual({ items: [], nextCursor: null, total: 120 });
    expect(pageOf(items, "0", 60).nextCursor).toBe("60");
  });
});

const snapshot = project({
  tickets: [
    ticket({ id: "t1", title: "Écran de connexion", statusId: "in_progress", labels: ["ui"] }),
    ticket({ id: "t2", title: "API des comptes", statusId: "todo", labels: ["api"] }),
    ticket({ id: "t3", title: "Connexion SSO", statusId: "todo", labels: ["api", "ui"] }),
  ],
  questions: [
    question({ id: "q1", ticketId: "t1", title: "Couleur ?", blocking: true }),
    answered(question({ id: "q2", ticketId: "t2", title: "Format ?" }), "JSON"),
  ],
});

describe("listTickets", () => {
  test("filters by status, label and a case-insensitive query on key or title", () => {
    const keys = (input: Parameters<typeof listTickets>[1]) =>
      listTickets(snapshot, input).items.map((c) => c.key);
    expect(keys({})).toEqual(["SILO-1", "SILO-2", "SILO-3"]);
    expect(keys({ status: "todo" })).toEqual(["SILO-2", "SILO-3"]);
    expect(keys({ label: "ui" })).toEqual(["SILO-1", "SILO-3"]);
    expect(keys({ query: "CONNEXION" })).toEqual(["SILO-1", "SILO-3"]);
    expect(keys({ query: "silo-2" })).toEqual(["SILO-2"]);
    expect(keys({ status: "todo", label: "ui" })).toEqual(["SILO-3"]);
  });

  test("returns ticket cards with paging", () => {
    expect(listTickets(snapshot, { status: "in_progress" })).toEqual({
      items: [
        {
          key: "SILO-1",
          title: "Écran de connexion",
          statusId: "in_progress",
          labels: ["ui"],
          assignee: null,
          parent: null,
          openQuestions: 0,
          startable: false,
          startReason: null,
          onHold: null,
          group: false,
          branch: null,
          pr: null,
        },
      ],
      nextCursor: null,
      total: 1,
    });
  });

  test("marks the groups of tickets", () => {
    const grouped = project({
      tickets: [
        ticket({ id: "t4", title: "C4", progress: { done: 1, total: 2 } }),
        ticket({ id: "t5", parentId: "t4" }),
      ],
    });
    expect(listTickets(grouped, {}).items.map((c) => [c.key, c.group])).toEqual([
      ["SILO-4", true],
      ["SILO-5", false],
    ]);
  });
});

describe("listQuestions", () => {
  test("filters by state and ticket key", () => {
    expect(listQuestions(snapshot, { state: "open" })).toEqual([
      {
        id: "q1",
        ticket: "SILO-1",
        title: "Couleur ?",
        state: "open",
        blocking: true,
        answer: null,
        recipient: "me",
        recipientName: "Moi (technique)",
        sentAt: null,
      },
    ]);
    expect(listQuestions(snapshot, { state: "answered" })).toEqual([
      {
        id: "q2",
        ticket: "SILO-2",
        title: "Format ?",
        state: "answered",
        blocking: false,
        answer: "JSON",
        recipient: "me",
        recipientName: "Moi (technique)",
        sentAt: null,
      },
    ]);
    expect(listQuestions(snapshot, { state: "all" }).map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(listQuestions(snapshot, { state: "all", ticketKey: "SILO-2" }).map((q) => q.id)).toEqual(["q2"]);
  });
});

describe("listRuns", () => {
  test("keeps the ticket runs of the project with their queue position", () => {
    const runs = [
      run({ id: "r1", state: "running", ticketId: "t1", ticketKey: "SILO-1", label: "opus-dev" }),
      run({ id: "r2", state: "queued", ticketId: "t2", ticketKey: "SILO-2", label: "opus-dev" }),
      run({ id: "r3", state: "done", ticketId: "t3", ticketKey: "SILO-3", label: "generateur" }),
      run({ id: "r4", projectId: "other", ticketId: "t1", state: "running" }),
      run({ id: "r5", state: "running" }),
    ];
    const queue = [{ runId: "r2", position: 1, reason: null }];
    expect(listRuns(runs, queue, "p1")).toEqual([
      { id: "r1", label: "opus-dev", state: "running", subject: "SILO-1", position: null },
      { id: "r2", label: "opus-dev", state: "queued", subject: "SILO-2", position: 1 },
      { id: "r3", label: "generateur", state: "done", subject: "SILO-3", position: null },
    ]);
    expect(listRuns(runs, queue, "p1", "queued").map((r) => r.id)).toEqual(["r2"]);
  });
});

test("compactJson has no whitespace", () => {
  expect(compactJson({ a: [1, { b: "c d" }] })).toBe('{"a":[1,{"b":"c d"}]}');
});
