import { describe, expect, test } from "bun:test";
import { fingerprint } from "./fingerprint";
import { answered, project, question, run, ticket } from "./test-kit";

const snapshot = project({
  tickets: [
    ticket({
      id: "t2",
      title: "Deux",
      statusId: "in_progress",
      labels: ["ui"],
      parentId: "t1",
      assignee: { kind: "agent", ref: "opus" },
      externalRefs: [
        { kind: "git_branch", branch: "feat/deux", base: null },
        {
          kind: "github_pr",
          url: "https://github.com/a/b/pull/12",
          number: 12,
          state: "open",
          base: null,
          head: null,
        },
      ],
    }),
    ticket({ id: "t1", title: "Un" }),
  ],
  questions: [question({ id: "q2", ticketId: "t1" }), answered(question({ id: "q1", ticketId: "t1" }))],
});

describe("fingerprint", () => {
  test("keeps the compact fields of tickets, questions, runs and notes", () => {
    const fp = fingerprint({
      project: snapshot,
      runs: [run({ id: "r1", state: "running" }), run({ id: "r9", projectId: "other", state: "done" })],
      notes: [
        { path: "b.md", hash: "h2" },
        { path: "a.md", hash: "h1" },
      ],
    });
    expect(fp.tickets.t2).toEqual({
      key: "EMIS-2",
      title: "Deux",
      statusId: "in_progress",
      labels: ["ui"],
      parentId: "t1",
      assignee: "opus",
      branch: "feat/deux",
      pr: "#12 (open)",
    });
    expect(fp.questions).toEqual({ q1: "answered", q2: "open" });
    expect(fp.runs).toEqual({ r1: "running" });
    expect(fp.notes).toEqual({ "a.md": "h1", "b.md": "h2" });
  });

  test("sorts every record by key", () => {
    const fp = fingerprint({
      project: snapshot,
      runs: [],
      notes: [
        { path: "b.md", hash: "x" },
        { path: "a.md", hash: "y" },
      ],
    });
    expect(Object.keys(fp.tickets)).toEqual(["t1", "t2"]);
    expect(Object.keys(fp.questions)).toEqual(["q1", "q2"]);
    expect(Object.keys(fp.notes)).toEqual(["a.md", "b.md"]);
  });
});
