import { describe, expect, test } from "bun:test";
import { foldSignal, type SignalEvent, type SignalRow } from "@kibo/schema";
import { answered, project, question, run, ticket } from "./test-kit";
import { compactJson, listQuestions, listRuns, listSignals, listTickets, pageOf } from "./tools";

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
        delivered: false,
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
        delivered: false,
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
      run({ id: "r1", state: "running", ticketKey: "SILO-1", label: "opus-dev" }),
      run({ id: "r2", state: "queued", ticketKey: "SILO-2", label: "opus-dev" }),
      run({ id: "r3", state: "done", ticketKey: null, ticketTitle: "Composant", label: "generateur" }),
      run({ id: "r4", projectId: "other", state: "running" }),
      run({ id: "r5", kind: "project", state: "running" }),
    ];
    const queue = [{ runId: "r2", position: 1, reason: null }];
    expect(listRuns(runs, queue, "p1")).toEqual([
      { id: "r1", label: "opus-dev", state: "running", subject: "SILO-1", position: null },
      { id: "r2", label: "opus-dev", state: "queued", subject: "SILO-2", position: 1 },
      { id: "r3", label: "generateur", state: "done", subject: "Composant", position: null },
    ]);
    expect(listRuns(runs, queue, "p1", "queued").map((r) => r.id)).toEqual(["r2"]);
  });
});

test("compactJson has no whitespace", () => {
  expect(compactJson({ a: [1, { b: "c d" }] })).toBe('{"a":[1,{"b":"c d"}]}');
});

describe("listSignals", () => {
  const row = (seq: number): SignalRow => ({
    id: `s${seq}`,
    seq,
    projectId: "p1",
    runId: "r1",
    runLabel: "opus-dev",
    profileName: "Opus",
    originTicketId: "t1",
    originTicketKey: "SILO-1",
    ticketId: "t1",
    ticketKey: "SILO-1",
    kind: "ticket",
    title: `Signal ${seq}`,
    body: "",
    createdAt: seq,
  });
  const closed: SignalEvent = { type: "handled", batchId: "b1", actionId: 1 };
  const signals = Array.from({ length: 70 }, (_, i) =>
    foldSignal(row(70 - i), (70 - i) % 7 === 0 ? [{ at: 100, event: closed }] : []),
  );

  test("lists open signals by default, oldest first, fifty per page", () => {
    const page = listSignals(signals, { state: "open" });
    expect(page.total).toBe(60);
    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).toBe("50");
    expect(page.items[0]).toEqual({
      ref: "sig:1",
      kind: "ticket",
      runLabel: "opus-dev",
      ticketKey: "SILO-1",
      createdAt: 1,
      status: "new",
      title: "Signal 1",
      body: "",
    });
    expect(listSignals(signals, { state: "open", cursor: "50" }).items).toHaveLength(10);
  });

  test("filters closed or all signals", () => {
    const closedPage = listSignals(signals, { state: "closed" });
    expect(closedPage.items.map((s) => s.ref)).toEqual([
      "sig:7",
      "sig:14",
      "sig:21",
      "sig:28",
      "sig:35",
      "sig:42",
      "sig:49",
      "sig:56",
      "sig:63",
      "sig:70",
    ]);
    expect(listSignals(signals, { state: "all" }).total).toBe(70);
  });
});
