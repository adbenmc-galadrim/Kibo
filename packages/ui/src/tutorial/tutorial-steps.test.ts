import { expect, test } from "bun:test";
import { type Page, TUTORIAL_NEVER, type TutorialSeed, type TutorialState } from "@kibo/schema";
import { stepViews } from "./tutorial-steps";

const seed: TutorialSeed = {
  ticketIds: [],
  linkKeys: [],
  layouts: {},
  noteHash: "h",
  dashboardPageId: "pd",
  graphPageId: "pg",
};
const page = (id: string, title: string, kind: Page["kind"]): Page => ({ id, title, kind, parentId: null });
const pages = [
  page("pd", "Tableau de bord", "dashboard"),
  page("pk", "Kanban", "view"),
  page("pg", "Graphe", "view"),
  page("pn", "Notes", "view"),
];
const active: TutorialState = {
  ...TUTORIAL_NEVER,
  status: "active",
  startedAt: 1,
  projectId: "p",
  completed: ["kanban"],
  seed,
};

test("stepViews marks completed and current steps and points each step to its page", () => {
  const views = stepViews(active, "p", pages);
  expect(views.map((v) => [v.step, v.done, v.current])).toEqual([
    ["kanban", true, false],
    ["links", false, true],
    ["note", false, false],
    ["dashboard", false, false],
    ["agent", false, false],
    ["component", false, false],
  ]);
  expect(views.map((v) => v.where)).toEqual([
    { kind: "page", projectId: "p", pageId: "pk" },
    { kind: "page", projectId: "p", pageId: "pg" },
    { kind: "page", projectId: "p", pageId: "pn" },
    { kind: "page", projectId: "p", pageId: "pd" },
    { kind: "page", projectId: "p", pageId: "pk" },
    { kind: "page", projectId: "p", pageId: "pd" },
  ]);
  expect(views[1]?.instruction).toContain("Graphe");
  expect(views[0]?.title).toBe("Créer un ticket et le déplacer");
});

test("a renamed or missing page leaves the step without destination, the seed ids still win", () => {
  const renamed = [page("pd", "Accueil", "dashboard"), page("pg", "Liens", "view")];
  const views = stepViews(active, "p", renamed);
  expect(views[0]?.where).toBeNull();
  expect(views[1]?.where).toEqual({ kind: "page", projectId: "p", pageId: "pg" });
  expect(views[3]?.where).toEqual({ kind: "page", projectId: "p", pageId: "pd" });
});

test("a finished tutorial has every step done and none current", () => {
  const done: TutorialState = {
    ...active,
    status: "done",
    completed: ["kanban", "links", "note", "dashboard", "agent", "component"],
  };
  expect(stepViews(done, "p", pages).every((v) => v.done && !v.current)).toBe(true);
});
