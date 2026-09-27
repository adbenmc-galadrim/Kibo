import { expect, mock, test } from "bun:test";
import type { Page } from "@kibo/schema";
import { isSeparator, isSubmenu, type MenuAction } from "@kibo/sdk/ui/menu-entries";
import { fr } from "../i18n/fr";
import { moveTargets, type PageMenuActions, pageMenuEntries, siblingIndex } from "./page-menu";

const page = (id: string, title: string, parentId: string | null): Page => ({
  id,
  title,
  kind: "dashboard",
  parentId,
});
const pages: Page[] = [
  page("dash", "Tableau de bord", null),
  page("kanban", "Kanban", null),
  page("k1", "Sprint", "kanban"),
  page("k11", "Rétro", "k1"),
  page("notes", "Notes", null),
];
const actions = (): PageMenuActions => ({
  openNewTab: mock(() => {}),
  newSubPage: mock(() => {}),
  rename: mock(() => {}),
  moveUp: mock(() => {}),
  moveDown: mock(() => {}),
  moveTo: mock((_p: string | null) => {}),
  remove: mock(() => {}),
});
const labels = (entries: ReturnType<typeof pageMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));
const action = (entries: ReturnType<typeof pageMenuEntries>, label: string): MenuAction => {
  const found = entries.find((e) => !isSeparator(e) && !isSubmenu(e) && e.label === label);
  if (!found || isSeparator(found) || isSubmenu(found)) throw new Error(`no action ${label}`);
  return found;
};

test("move targets exclude the page itself and its descendants", () => {
  expect(moveTargets(pages, pages[1] as Page).map((p) => p.id)).toEqual(["dash", "notes"]);
  expect(moveTargets(pages, pages[4] as Page).map((p) => p.id)).toEqual(["dash", "kanban", "k1", "k11"]);
});

test("sibling index counts within the same parent, in snapshot order", () => {
  expect(siblingIndex(pages, pages[0] as Page)).toEqual({ index: 0, count: 3 });
  expect(siblingIndex(pages, pages[4] as Page)).toEqual({ index: 2, count: 3 });
  expect(siblingIndex(pages, pages[3] as Page)).toEqual({ index: 0, count: 1 });
});

test("an editable page gets the full menu, bounds disable Monter / Descendre", () => {
  const a = actions();
  const entries = pageMenuEntries({
    page: pages[1] as Page,
    pages,
    editable: true,
    texts: fr.nav,
    actions: a,
  });
  expect(labels(entries)).toEqual([
    "Ouvrir dans un nouvel onglet",
    "Nouvelle sous-page",
    "Renommer…",
    "Monter",
    "Descendre",
    "Déplacer vers ▸",
    "—",
    "Supprimer…",
  ]);
  expect(action(entries, "Monter").disabled).toBeFalsy();
  expect(action(entries, "Descendre").disabled).toBeFalsy();
  const first = pageMenuEntries({ page: pages[0] as Page, pages, editable: true, texts: fr.nav, actions: a });
  expect(action(first, "Monter").disabled).toBe(true);
  const last = pageMenuEntries({ page: pages[4] as Page, pages, editable: true, texts: fr.nav, actions: a });
  expect(action(last, "Descendre").disabled).toBe(true);
  const only = pageMenuEntries({ page: pages[3] as Page, pages, editable: true, texts: fr.nav, actions: a });
  expect(action(only, "Monter").disabled).toBe(true);
  expect(action(only, "Descendre").disabled).toBe(true);
});

test("Déplacer vers lists Racine then the targets, the current parent disabled", () => {
  const a = actions();
  const entries = pageMenuEntries({
    page: pages[2] as Page,
    pages,
    editable: true,
    texts: fr.nav,
    actions: a,
  });
  const sub = entries.find(isSubmenu);
  expect(sub?.items.map((i) => [i.label, i.disabled ?? false])).toEqual([
    ["Racine", false],
    ["Tableau de bord", false],
    ["Kanban", true],
    ["Notes", false],
  ]);
  sub?.items[0]?.onSelect();
  sub?.items[1]?.onSelect();
  expect(a.moveTo).toHaveBeenNthCalledWith(1, null);
  expect(a.moveTo).toHaveBeenNthCalledWith(2, "dash");
  action(entries, "Supprimer…").onSelect();
  expect(a.remove).toHaveBeenCalledTimes(1);
  expect(action(entries, "Supprimer…").destructive).toBe(true);
});

test("a read-only project only opens the page in a new tab", () => {
  const entries = pageMenuEntries({
    page: pages[1] as Page,
    pages,
    editable: false,
    texts: fr.nav,
    actions: actions(),
  });
  expect(labels(entries)).toEqual(["Ouvrir dans un nouvel onglet"]);
});
