import { expect, test } from "bun:test";
import { StarterPlan } from "@kibo/schema";
import { chosenPages, presetFor, ROLE_PRESETS, toSelection } from "./presets";

const all = new Set(["kanban", "tickets", "graph", "notes"]);

test("every preset is a valid StarterPlan and never lists Changements", () => {
  for (const plan of Object.values(ROLE_PRESETS)) {
    expect(StarterPlan.safeParse(plan).success).toBe(true);
    expect(JSON.stringify(plan)).not.toContain("changes");
  }
});

test("the developer preset follows the spec", () => {
  expect(presetFor("dev", all)?.pages.map((p) => [p.title, p.kind, p.components.map((c) => c.id)])).toEqual([
    ["Tableau de bord", "dashboard", ["kanban", "tickets", "graph"]],
    ["Kanban", "view", ["kanban"]],
    ["Tickets", "view", ["tickets"]],
    ["Graphe", "view", ["graph"]],
    ["Notes", "view", ["notes"]],
  ]);
  expect(presetFor("dev", all)?.pages[0]?.components[1]?.config).toEqual({ filter: "mine" });
});

test("other falls back to the developer preset", () => {
  expect(presetFor("other", all)).toEqual(presetFor("dev", all));
});

test("components missing from the catalog are removed, then empty pages", () => {
  const plan = presetFor("pm", new Set(["kanban", "tickets"]));
  expect(plan?.pages.map((p) => [p.title, p.components.map((c) => c.id)])).toEqual([
    ["Tableau de bord", ["kanban"]],
    ["Tickets", ["tickets"]],
  ]);
  expect(presetFor("designer", new Set())).toBeNull();
});

test("selection keeps checked pages with a trimmed title", () => {
  const selection = toSelection(presetFor("designer", all));
  expect(selection.every((p) => p.checked)).toBe(true);
  const edited = selection.map((p, i) =>
    i === 0 ? { ...p, title: "  Accueil  " } : i === 1 ? { ...p, checked: false } : p,
  );
  expect(chosenPages(edited).map((p) => p.title)).toEqual(["Accueil", "Notes"]);
  expect(chosenPages(edited.map((p) => ({ ...p, title: " " })))).toEqual([]);
  expect(toSelection(null)).toEqual([]);
});
