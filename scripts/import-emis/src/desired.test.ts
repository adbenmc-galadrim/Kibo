import { expect, test } from "bun:test";
import { join } from "node:path";
import type { ImportRef, StatusId } from "@kibo/schema";
import { desiredState } from "./desired";
import { loadEmisFiles } from "./emis-files";
import { loadAnswers, loadPlan, type PlanStatus } from "./plan-source";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "emis");
const plan = loadPlan(join(FIXTURE, "tmp", "plan-data.js"));
const answers = loadAnswers(join(FIXTURE, "tmp", "reponses.json"));
const files = loadEmisFiles(FIXTURE, join(FIXTURE, "emis"));
const ref = (source: string, id: string): ImportRef => ({ kind: "import_ref", source, id });
const pr4 = {
  number: 4,
  url: `${plan.meta.repo}/pull/4`,
  state: "draft" as const,
  base: "dev",
  head: "feat/coquille",
};
const desired = desiredState({
  plan,
  answers,
  files,
  repoUrl: plan.meta.repo,
  prs: new Map([[4, pr4]]),
  notesDir: "/notes",
});

test("chapters, prs, questions and todo items become tickets with stable import refs", () => {
  const byRef = new Map(desired.tickets.map((t) => [`${t.ref.source}:${t.ref.id}`, t]));
  expect(byRef.get("plan:C0")).toMatchObject({ title: "C0 · Socle", parent: null, labels: [] });
  expect(byRef.get("plan:C1-2")).toMatchObject({
    title: "C1-2 · Connexion Microsoft",
    parent: { kind: "import_ref", source: "plan", id: "C1" },
    statusId: "todo",
    labels: ["area:api", "area:web", "phase:p1", "sprint:s2"],
  });
  expect(byRef.get("plan:C1-2")?.description).toContain("## Périmètre");
  expect(byRef.get("plan:C1-2")?.refs).toEqual([
    { kind: "git_branch", branch: "feat/connexion", base: "spike/sso" },
  ]);
  expect(byRef.get("plan:C0-2")?.refs).toEqual(
    expect.arrayContaining([
      {
        kind: "github_pr",
        url: `${plan.meta.repo}/pull/4`,
        number: 4,
        state: "draft",
        base: "dev",
        head: "feat/coquille",
      },
      { kind: "git_branch", branch: "feat/coquille", base: null },
    ]),
  );
  expect(byRef.get("plan:C0-2")?.statusId).toBe("in_review");
  expect(byRef.get("plan:C0-1")?.statusId).toBe("done");
  expect(byRef.get("plan:C0-3")).toMatchObject({ statusId: "blocked", blockedReason: "Attend AWS" });
  expect(byRef.get("plan:C1-1")?.refs.find((r) => r.kind === "github_pr")).toMatchObject({
    state: "open",
    base: null,
  });
  expect(byRef.get("plan:arbitrages")).toMatchObject({
    title: "Arbitrages",
    parent: null,
    statusId: "todo",
    description: "Questions du plan Emis sans ticket\n",
  });
  expect(desired.tickets.filter((t) => /^Q\d+$|^arbitrages\//.test(t.ref.id))).toEqual([]);
  expect(byRef.get("todo:DATA-1")).toMatchObject({
    title: "DATA-1 · Liste réelle des sites à confirmer avec le client.",
    labels: ["decision:pending", "priority:p0"],
    parent: { kind: "import_ref", source: "plan", id: "todo" },
  });
  expect(byRef.get("todo:DEV-1")?.labels).toEqual(["priority:unsorted"]);
  expect(desired.tickets).toHaveLength(2 + 6 + 1 + 1 + 2);
  expect(desired.links).toContainEqual({ from: ref("plan", "C0-1"), to: ref("plan", "C0-2") });
  expect(desired.links).toHaveLength(6);
  expect(desired.questions.map((q) => [q.ref.id, q.ticket.id])).toEqual([
    ["Q1", "C0-3"],
    ["Q2", "arbitrages"],
    ["Q3", "C1-2"],
  ]);
});

test("questions never change a pr status: every pr keeps the status of the plan", () => {
  const status: Record<PlanStatus, StatusId> = {
    todo: "todo",
    wip: "in_progress",
    review: "in_review",
    done: "done",
    blocked: "blocked",
  };
  for (const c of plan.chapters)
    for (const p of c.prs)
      expect(desired.tickets.find((t) => t.ref.id === p.id)?.statusId).toBe(status[p.status]);
});

test("parents always come before their children", () => {
  const seen = new Set<string>();
  for (const t of desired.tickets) {
    if (t.parent) expect(seen.has(`${t.parent.source}:${t.parent.id}`)).toBe(true);
    seen.add(`${t.ref.source}:${t.ref.id}`);
  }
});

test("a blocked pr without note takes the default reason, even when a question blocks it", () => {
  const blocked = {
    ...plan,
    chapters: plan.chapters.map((c) => ({
      ...c,
      prs: c.prs.map((p) => (p.id === "C1-2" || p.id === "C1-3" ? { ...p, status: "blocked" as const } : p)),
    })),
  };
  const d = desiredState({
    plan: blocked,
    answers: {},
    files,
    repoUrl: plan.meta.repo,
    prs: new Map(),
    notesDir: "/n",
  });
  const reason = (id: string) => d.tickets.find((t) => t.ref.id === id)?.blockedReason;
  expect(reason("C1-2")).toBe("Bloquée dans le plan Emis");
  expect(reason("C1-3")).toBe("Bloquée dans le plan Emis");
});

test("notes carry their source and the tickets they cite; the repo readmes are listed, not copied", () => {
  const paths = desired.notes.map((n) => n.path);
  expect(paths).toEqual(
    expect.arrayContaining([
      "pilotage/regles-worktrees.md",
      "pilotage/journal.md",
      "pilotage/plan.md",
      "pilotage/decisions.md",
      "pilotage/etat.md",
      "pilotage/sprints.md",
      "pilotage/chemin-critique.md",
      "pilotage/process.md",
      "pilotage/depot.md",
      "metier/lexique.md",
      "metier/passation/index.md",
      "metier/passation/00-l-essentiel.md",
      "metier/passation/01-contexte.md",
      "briefs/C0-2.md",
      "briefs/C1-1.md",
    ]),
  );
  expect(new Set(paths).size).toBe(paths.length);
  const brief = desired.notes.find((n) => n.path === "briefs/C0-2.md");
  expect(brief?.content.startsWith("---\nsource: tmp/briefs/C0-2.md\nimported: 2026-10-06\n")).toBe(true);
  expect(brief?.content).toContain("tickets: [plan:C0-2]");
  expect(desired.notes.find((n) => n.path === "briefs/C1-1.md")?.content).toContain(
    "tickets: [plan:C1-1, plan:C1-2]",
  );
  expect(desired.notes.find((n) => n.path === "metier/passation/00-l-essentiel.md")?.content).toContain(
    "tickets: [plan:C1-2]",
  );
  expect(desired.notes.find((n) => n.path === "metier/passation/index.md")?.content).toContain(
    "(00-l-essentiel.md)",
  );
  expect(desired.notes.find((n) => n.path === "pilotage/regles-worktrees.md")?.content).not.toContain(
    "## 4.",
  );
  expect(desired.guidelines.map((g) => g.path)).toEqual(["emis/regles.md", "emis/livraison.md"]);
  expect(desired.guidelines[0]?.content).not.toContain("## 4.");
  expect(desired.guidelines[1]?.content).toContain("/notes/briefs/");
  expect(desired.guidelines[1]?.content).toContain("Les PR de feature ciblent `dev`.");
  expect(desired.guidelines[1]?.content).not.toContain("plan-check");
  expect(desired.guidelines[1]?.content).toContain(
    "- Toute décision non tranchée passe par `ask_question` (choix provisoire, tu continues) ou `ask_user` (tu attends) ; **jamais dans le texte final**, Kibo ne le lit pas.",
  );
  expect(desired.guidelines[1]?.content).not.toContain("Toute question passe par `ask_user`");
  expect(desired.profile).toMatchObject({
    name: "emis-livraison",
    model: "opus",
    permissionMode: "auto",
    workspace: "worktree",
    maxParallel: 2,
    allow: [
      "Bash(pnpm *)",
      "Bash(git *)",
      "Bash(gh pr *)",
      "Bash(docker compose *)",
      "Bash(npx playwright *)",
    ],
  });
});

test("project and pages", () => {
  expect(desired.project).toEqual({ name: "Emis", key: "EMIS", color: "#B45309" });
  expect(desired.pages.map((p) => [p.title, p.kind, p.instances.map((i) => i.componentId)])).toEqual([
    ["Tableau de bord", "dashboard", ["kanban", "graph"]],
    ["Plan", "view", ["tickets"]],
    ["Graphe", "view", ["graph"]],
    ["Notes", "view", ["notes"]],
  ]);
});

test("the graph shows every ticket: imported tickets have no assignee", () => {
  const graphs = desired.pages.flatMap((p) => p.instances.filter((i) => i.componentId === "graph"));
  expect(graphs.map((i) => i.config)).toEqual([{ filter: "all" }, { filter: "all" }]);
});
