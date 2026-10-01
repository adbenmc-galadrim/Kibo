import { expect, mock, test } from "bun:test";
import type { FileChange } from "@kibo/schema";
import { isSeparator, isSubmenu } from "@kibo/sdk/ui/menu-entries";
import { fr } from "../i18n/fr";
import { discardLines, discardPaths, type FileMenuActions, fileMenuEntries } from "./file-menu";

const file = (patch: Partial<FileChange>): FileChange => ({
  path: "packages/core/ticket.ts",
  origPath: null,
  area: "unstaged",
  kind: "modified",
  additions: 1,
  deletions: 1,
  ...patch,
});
const actions = (): FileMenuActions => ({
  viewDiff: mock(() => {}),
  openInTab: mock(() => {}),
  openExternal: mock(() => {}),
  copyPath: mock(() => {}),
  toggleStage: mock(() => {}),
  discard: mock(() => {}),
});
const labels = (entries: ReturnType<typeof fileMenuEntries>) =>
  entries.map((e) => (isSeparator(e) ? "—" : isSubmenu(e) ? `${e.label} ▸` : e.label));
const entriesFor = (patch: Partial<FileChange>, readOnly = false, a = actions()) =>
  fileMenuEntries({ file: file(patch), readOnly, texts: fr.changes, actions: a });

test("an unstaged file offers Ajouter au commit, a staged one Retirer du commit", () => {
  const a = actions();
  const entries = entriesFor({}, false, a);
  expect(labels(entries)).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Ouvrir dans l'éditeur externe",
    "Copier le chemin",
    "—",
    "Ajouter au commit",
    "—",
    "Annuler les changements…",
  ]);
  expect(labels(entriesFor({ area: "staged" }))).toContain("Retirer du commit");
  const discard = entries.at(-1);
  expect(discard && !isSeparator(discard) && !isSubmenu(discard) && discard.destructive).toBe(true);
  if (discard && !isSeparator(discard) && !isSubmenu(discard)) discard.onSelect();
  expect(a.discard).toHaveBeenCalledTimes(1);
});

test("a conflicted file can neither be added to the commit nor discarded", () => {
  expect(labels(entriesFor({ kind: "conflicted" }))).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Ouvrir dans l'éditeur externe",
    "Copier le chemin",
  ]);
});

test("a remote session only views, opens in a tab and copies the path", () => {
  expect(labels(entriesFor({}, true))).toEqual(["Voir le diff", "Ouvrir dans un onglet", "Copier le chemin"]);
  expect(labels(entriesFor({ area: "staged", kind: "added" }, true))).toEqual([
    "Voir le diff",
    "Ouvrir dans un onglet",
    "Copier le chemin",
  ]);
});

test("discard lines say what is restored and what is deleted from disk", () => {
  const lines = (patch: Partial<FileChange>) => discardLines(file(patch), fr.changes);
  expect(lines({})).toEqual(["ticket.ts reviendra à sa dernière version commitée."]);
  expect(lines({ path: "docs/notes.md", kind: "untracked" })).toEqual([
    "notes.md est nouveau : il sera supprimé du disque.",
  ]);
  expect(lines({ path: "docs/notes.md", area: "staged", kind: "added" })).toEqual([
    "notes.md est nouveau : il sera supprimé du disque.",
  ]);
  expect(lines({ kind: "deleted" })).toEqual(["ticket.ts reviendra à sa dernière version commitée."]);
  expect(
    lines({ path: "src/renamed.ts", origPath: "src/legacy.ts", area: "staged", kind: "renamed" }),
  ).toEqual(["renamed.ts disparaîtra et legacy.ts reviendra à sa dernière version commitée."]);
});

test("a rename sends its source with its path", () => {
  expect(discardPaths(file({}))).toEqual(["packages/core/ticket.ts"]);
  expect(discardPaths(file({ path: "src/renamed.ts", origPath: "src/legacy.ts", kind: "renamed" }))).toEqual([
    "src/renamed.ts",
    "src/legacy.ts",
  ]);
});
