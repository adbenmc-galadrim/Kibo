import type { Role, StarterPage, StarterPlan } from "@kibo/schema";

export const ROLE_ORDER: Role[] = ["dev", "designer", "pm", "other"];

const view = (title: string, id: string): StarterPage => ({
  title,
  kind: "view",
  components: [{ id, config: {} }],
});
const mine = { id: "tickets", config: { filter: "mine" } };

export const ROLE_PRESETS: Record<Exclude<Role, "other">, StarterPlan> = {
  dev: {
    pages: [
      {
        title: "Tableau de bord",
        kind: "dashboard",
        components: [{ id: "kanban", config: {} }, mine, { id: "graph", config: {} }],
      },
      view("Kanban", "kanban"),
      view("Tickets", "tickets"),
      view("Graphe", "graph"),
      view("Notes", "notes"),
    ],
  },
  designer: {
    pages: [
      { title: "Tableau de bord", kind: "dashboard", components: [mine, { id: "notes", config: {} }] },
      view("Kanban", "kanban"),
      view("Notes", "notes"),
    ],
  },
  pm: {
    pages: [
      {
        title: "Tableau de bord",
        kind: "dashboard",
        components: [
          { id: "kanban", config: {} },
          { id: "graph", config: {} },
        ],
      },
      view("Tickets", "tickets"),
      view("Graphe", "graph"),
    ],
  },
};

export function presetFor(role: Role, available: ReadonlySet<string>): StarterPlan | null {
  const base = ROLE_PRESETS[role === "other" ? "dev" : role];
  const pages = base.pages
    .map((p) => ({ ...p, components: p.components.filter((c) => available.has(c.id)) }))
    .filter((p) => p.components.length > 0);
  return pages.length > 0 ? { pages } : null;
}

export type SelectedPage = StarterPage & { key: string; checked: boolean };

export const toSelection = (plan: StarterPlan | null): SelectedPage[] =>
  (plan?.pages ?? []).map((p, i) => ({ ...p, key: `${i}:${p.title}`, checked: true }));

export const chosenPages = (selection: SelectedPage[]): StarterPage[] =>
  selection
    .filter((p) => p.checked && p.title.trim().length > 0)
    .map(({ key: _key, checked: _checked, ...page }) => ({ ...page, title: page.title.trim() }));
