import { describe, expect, test } from "bun:test";
import { type OverviewInput, projectOverview, renderOverview, ticketCard, ticketSheet } from "./overview";
import { answered, link, PROFILES, project, question, run, ticket } from "./test-kit";

const pr = {
  kind: "github_pr" as const,
  url: "https://github.com/a/b/pull/7",
  number: 7,
  state: "open" as const,
  base: null,
  head: null,
};

const snapshot = project({
  tickets: [
    ticket({ id: "t1", title: "Parent", statusId: "done" }),
    ticket({
      id: "t2",
      title: "Écran",
      statusId: "in_review",
      labels: ["ui"],
      parentId: "t1",
      assignee: { kind: "agent", ref: "opus" },
      externalRefs: [pr, { kind: "git_branch", branch: "feat/ecran", base: "main" }],
      openQuestions: 1,
    }),
    ticket({ id: "t3", title: "API", statusId: "in_progress" }),
    ticket({ id: "t4", title: "Bloqué", statusId: "blocked", blockedReason: "attente" }),
    ticket({ id: "t5", title: "Plus tard", statusId: "backlog" }),
  ],
  links: [link("l1", "t3", "t2"), link("l2", "t2", "t4"), link("l3", "t5", "t2", "relates")],
  questions: [
    question({ id: "q1", ticketId: "t2", title: "Couleur ?", blocking: true }),
    answered(question({ id: "q2", ticketId: "t2", title: "Police ?" }), "Inter"),
  ],
});

const input = (p: Partial<OverviewInput> = {}): OverviewInput => ({
  project: snapshot,
  runs: [
    run({ id: "r1", state: "running", ticketId: "t3", ticketKey: "EMIS-3", label: "opus-dev" }),
    run({ id: "r2", state: "queued", ticketId: "t2", ticketKey: "EMIS-2", label: "opus-dev" }),
    run({ id: "r3", state: "done", ticketId: "t2", ticketKey: "EMIS-2", label: "opus-dev", turns: 2 }),
    run({ id: "r4", kind: "project", state: "running" }),
  ],
  queue: [{ runId: "r2", position: 1, reason: null }],
  notes: [{ path: "agent-de-projet/memoire.md", title: "Mémoire" }],
  profiles: PROFILES,
  demoProject: false,
  memory: "- Adam préfère les petits lots.",
  ...p,
});

describe("projectOverview", () => {
  test("counts tickets per status in workflow order", () => {
    expect(projectOverview(input()).statuses).toEqual([
      { id: "backlog", name: "Backlog", count: 1 },
      { id: "todo", name: "À faire", count: 0 },
      { id: "in_progress", name: "En cours", count: 1 },
      { id: "in_review", name: "En review", count: 1 },
      { id: "blocked", name: "Bloqué", count: 1 },
      { id: "done", name: "Terminé", count: 1 },
    ]);
  });

  test("details the active tickets, active runs, open questions, notes, profiles and memory", () => {
    const overview = projectOverview(input());
    expect(overview).toMatchObject({ name: "Emis", key: "EMIS", memory: "- Adam préfère les petits lots." });
    expect(overview.active.map((c) => c.key)).toEqual(["EMIS-2", "EMIS-3", "EMIS-4"]);
    expect(overview.active[0]).toEqual({
      key: "EMIS-2",
      title: "Écran",
      statusId: "in_review",
      labels: ["ui"],
      assignee: "opus",
      parent: "EMIS-1",
      openQuestions: 1,
      branch: "feat/ecran",
      pr: "#7 (open)",
    });
    expect(overview.runs).toEqual([
      { id: "r1", label: "opus-dev", state: "running", subject: "EMIS-3", position: null },
      { id: "r2", label: "opus-dev", state: "queued", subject: "EMIS-2", position: 1 },
    ]);
    expect(overview.openQuestions).toEqual([
      { id: "q1", ticket: "EMIS-2", title: "Couleur ?", blocking: true },
    ]);
    expect(overview.notes).toEqual([{ path: "agent-de-projet/memoire.md", title: "Mémoire" }]);
    expect(overview.profiles).toEqual([{ id: "opus", name: "opus-dev", model: "opus" }]);
  });

  test("the demo profile is assignable only in the demo project, project-agent never", () => {
    expect(projectOverview(input({ demoProject: true })).profiles.map((p) => p.id)).toEqual(["opus", "demo"]);
  });
});

describe("renderOverview", () => {
  test("is compact Markdown with the memory note", () => {
    const text = renderOverview(projectOverview(input()));
    expect(text).toContain("# Emis (EMIS)");
    expect(text).toContain("- EMIS-2 · Écran [in_review] étiquettes ui · assigné opus · PR #7 (open)");
    expect(text).toContain("- opus-dev · EMIS-2 : en file (position 1)");
    expect(text).toContain("- q1 · EMIS-2 · Couleur ? (bloquante)");
    expect(text).toContain("- Adam préfère les petits lots.");
  });

  test("stays under 4 000 characters with 50 active tickets", () => {
    const tickets = Array.from({ length: 50 }, (_, i) =>
      ticket({
        id: `t${i + 1}`,
        title: "Un titre très long ".repeat(10),
        statusId: "in_progress",
        labels: ["ui", "api"],
      }),
    );
    const text = renderOverview(
      projectOverview(input({ project: project({ tickets }), runs: [], queue: [] })),
    );
    expect(text.length).toBeLessThanOrEqual(4_000);
    expect(text).not.toContain("Un titre très long ".repeat(5));
  });
});

describe("ticket card and sheet", () => {
  test("a pending ticket shows its key label", () => {
    const pending = ticket({ id: "t9", key: null, pendingSeq: 1 });
    expect(ticketCard(snapshot, pending).key).toBe("EMIS-…");
  });

  test("the sheet adds description, links by key, questions with answers and runs", () => {
    const t2 = snapshot.tickets[1];
    if (!t2) throw new Error("fixture");
    const sheet = ticketSheet(snapshot, { ...t2, description: "Faire l'écran" }, input().runs);
    expect(sheet).toMatchObject({
      key: "EMIS-2",
      description: "Faire l'écran",
      blockedReason: null,
      blocks: ["EMIS-4"],
      blockedBy: ["EMIS-3"],
      relates: ["EMIS-5"],
      questions: [
        { id: "q1", title: "Couleur ?", state: "open", answer: null },
        { id: "q2", title: "Police ?", state: "answered", answer: "Inter" },
      ],
      runs: [
        { id: "r2", label: "opus-dev", state: "queued", turns: 0 },
        { id: "r3", label: "opus-dev", state: "done", turns: 2 },
      ],
    });
  });
});
