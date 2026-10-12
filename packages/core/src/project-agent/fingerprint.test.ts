import { describe, expect, test } from "bun:test";
import { changeNames, diffFingerprints } from "./digest";
import { fingerprint } from "./fingerprint";
import { answered, link, project, question, run, ticket } from "./test-kit";

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
      blockedBy: [],
    });
    expect(fp.questions).toEqual({
      q1: { state: "answered", title: "Question q1", recipient: "me" },
      q2: { state: "open", title: "Question q2", recipient: "me" },
    });
    expect(fp.runs).toEqual({ r1: "running" });
    expect(fp.notes).toEqual({ "a.md": "h1", "b.md": "h2" });
  });

  test("never fingerprints a project run, so the digest never reports the agent's own turns", () => {
    const at = (state: "starting" | "running") =>
      fingerprint({
        project: snapshot,
        runs: [run({ id: "r1", state: "running" }), run({ id: "p1", kind: "project", state })],
        notes: [],
      });
    expect(at("starting").runs).toEqual({ r1: "running" });
    expect(
      diffFingerprints(at("starting"), at("running"), changeNames(snapshot, [], at("starting"))),
    ).toEqual([]);
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

describe("blocking links", () => {
  test("a ticket keeps the sorted keys of the tickets that block it", () => {
    const blocked = project({
      tickets: [
        ticket({ id: "t15", key: "BOU-15" }),
        ticket({ id: "t13", key: "BOU-13" }),
        ticket({ id: "t12", key: "BOU-12" }),
        ticket({ id: "t9", key: null }),
      ],
      links: [
        link("l1", "t13", "t15"),
        link("l2", "t12", "t15"),
        link("l3", "t12", "t13", "relates"),
        link("l4", "t9", "t13"),
      ],
    });
    const fp = fingerprint({ project: blocked, runs: [], notes: [] });
    expect(fp.tickets.t15?.blockedBy).toEqual(["BOU-12", "BOU-13"]);
    expect(fp.tickets.t13?.blockedBy).toEqual(["t9"]);
    expect(fp.tickets.t12?.blockedBy).toEqual([]);
  });
});
