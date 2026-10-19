import { describe, expect, test } from "bun:test";
import { type OverviewInput, projectOverview, renderOverview, ticketCard, ticketSheet } from "./overview";
import { AGENTS, answered, link, project, question, run, ticket } from "./test-kit";

const pr = {
  kind: "github_pr" as const,
  url: "https://github.com/a/b/pull/7",
  number: 7,
  state: "open" as const,
  base: null,
  head: null,
  review: "none" as const,
  checks: null,
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
    run({ id: "r1", state: "running", ticketId: "t3", ticketKey: "SILO-3", label: "opus-dev" }),
    run({ id: "r2", state: "queued", ticketId: "t2", ticketKey: "SILO-2", label: "opus-dev" }),
    run({ id: "r3", state: "done", ticketId: "t2", ticketKey: "SILO-2", label: "opus-dev", turns: 2 }),
    run({ id: "r4", kind: "project", state: "running" }),
  ],
  queue: [{ runId: "r2", position: 1, reason: null }],
  notes: [{ path: "agent-de-projet/memoire.md", title: "Mémoire" }],
  agents: AGENTS,
  demoProject: false,
  memory: "- Adam préfère les petits lots.",
  openSignals: 0,
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

  test("details the active tickets, active runs, open questions, notes, agents and memory", () => {
    const overview = projectOverview(input());
    expect(overview).toMatchObject({ name: "Silo", key: "SILO", memory: "- Adam préfère les petits lots." });
    expect(overview.active.map((c) => c.key)).toEqual(["SILO-2", "SILO-3", "SILO-4"]);
    expect(overview.active[0]).toEqual({
      key: "SILO-2",
      title: "Écran",
      statusId: "in_review",
      labels: ["ui"],
      assignee: "opus",
      parent: "SILO-1",
      openQuestions: 1,
      startable: false,
      startReason: null,
      group: false,
      branch: "feat/ecran",
      pr: "#7 (open)",
    });
    expect(overview.runs).toEqual([
      { id: "r1", label: "opus-dev", state: "running", subject: "SILO-3", position: null },
      { id: "r2", label: "opus-dev", state: "queued", subject: "SILO-2", position: 1 },
    ]);
    expect(overview.openQuestions).toEqual([
      { id: "q1", ticket: "SILO-2", title: "Couleur ?", blocking: true, recipient: "me" },
    ]);
    expect(overview.notes).toEqual([{ path: "agent-de-projet/memoire.md", title: "Mémoire" }]);
    expect(overview.profiles).toEqual([
      {
        id: "global:opus-dev",
        name: "opus-dev",
        scope: "global",
        description: "Agent opus-dev",
        model: "opus",
      },
    ]);
  });

  test("the demo agent is assignable only in the demo project, the project agent never", () => {
    expect(projectOverview(input({ demoProject: true })).profiles.map((p) => p.id)).toEqual([
      "global:opus-dev",
      "system:demo",
    ]);
  });

  test("lists the sprints of the project", () => {
    const sprints = [{ id: "s1", code: "S42", name: "Saisie", start: "2026-10-12", end: "2026-10-16" }].map(
      (s) => ({ ...s, state: "current" as const, features: [], delivered: 0, total: 0, lingering: false }),
    );
    const base = input();
    const overview = projectOverview({ ...base, project: { ...base.project, sprints } });
    expect(overview.sprints).toEqual([
      {
        id: "s1",
        code: "S42",
        name: "Saisie",
        start: "2026-10-12",
        end: "2026-10-16",
        state: "current",
        features: [],
      },
    ]);
  });
});

describe("renderOverview", () => {
  test("is compact Markdown with the memory note", () => {
    const text = renderOverview(projectOverview(input()));
    expect(text).toContain("# Silo (SILO)");
    expect(text).toContain("- SILO-2 · Écran [in_review] étiquettes ui · assigné opus · PR #7 (open)");
    expect(text).toContain("- opus-dev · SILO-2 : en file (position 1)");
    expect(text).toContain("- q1 · SILO-2 · Couleur ? (bloquante)");
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
  test("a card says whether the ticket is startable", () => {
    const ready = ticket({ id: "t8", title: "Prêt", statusId: "in_progress", startable: true });
    expect(ticketCard(snapshot, ready).startable).toBe(true);
    expect(ticketCard(snapshot, ticket({ id: "t7" })).startable).toBe(false);
    const text = renderOverview(projectOverview(input({ project: project({ tickets: [ready] }) })));
    expect(text).toContain("- SILO-8 · Prêt [in_progress] · démarrable");
  });

  test("a card says why a ticket cannot start yet", () => {
    const startReason = { kind: "limit", limit: 2, count: 2 } as const;
    expect(ticketCard(snapshot, ticket({ id: "t8", startReason })).startReason).toEqual(startReason);
    expect(ticketCard(snapshot, ticket({ id: "t8", startable: true })).startReason).toBeNull();
  });

  test("a pending ticket shows its key label", () => {
    const pending = ticket({ id: "t9", key: null, pendingSeq: 1 });
    expect(ticketCard(snapshot, pending).key).toBe("SILO-…");
  });

  test("the sheet adds description, links by key, questions with answers and runs", () => {
    const t2 = snapshot.tickets[1];
    if (!t2) throw new Error("fixture");
    const sheet = ticketSheet(snapshot, { ...t2, description: "Faire l'écran" }, input().runs);
    expect(sheet).toMatchObject({
      key: "SILO-2",
      description: "Faire l'écran",
      blockedReason: null,
      blocks: ["SILO-4"],
      blockedBy: ["SILO-3"],
      relates: ["SILO-5"],
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

describe("open signals in the overview", () => {
  test("are counted and rendered", () => {
    expect(projectOverview(input({ openSignals: 2 })).openSignals).toBe(2);
    expect(renderOverview(projectOverview(input({ openSignals: 2 })))).toContain(
      "## Signaux\n\nSignaux ouverts : 2",
    );
    expect(renderOverview(projectOverview(input()))).toContain("## Signaux\n\nAucun.");
  });
});
