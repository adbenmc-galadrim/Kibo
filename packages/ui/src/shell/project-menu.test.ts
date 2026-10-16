import { expect, mock, test } from "bun:test";
import { isSeparator } from "@kibo/sdk/ui/menu-entries";
import { projectMenuEntries } from "./project-menu";

const texts = {
  newPage: "Nouvelle page",
  planning: "Ajouter la page Planning",
  share: "Partager",
  edit: "Modifier…",
  files: "Fichiers du projet…",
  remove: "Supprimer…",
};
const actions = () => ({
  newPage: mock(() => {}),
  planning: null,
  share: mock(() => {}),
  edit: mock(() => {}),
  files: mock(() => {}),
  remove: mock(() => {}),
});

test("an editable project offers new page, share, edit, files, then delete after a separator", () => {
  const a = actions();
  const entries = projectMenuEntries({ editable: true, texts, actions: a });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label))).toEqual([
    "Nouvelle page",
    "Partager",
    "Modifier…",
    "Fichiers du projet…",
    "—",
    "Supprimer…",
  ]);
  const last = entries[5];
  if (!last || isSeparator(last) || !("onSelect" in last)) throw new Error("expected an action");
  expect(last.destructive).toBe(true);
  last.onSelect();
  expect(a.remove).toHaveBeenCalledTimes(1);
});

test("a read-only project keeps share, its files on this device and delete", () => {
  const a = actions();
  const entries = projectMenuEntries({ editable: false, texts, actions: a });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label))).toEqual([
    "Partager",
    "Fichiers du projet…",
    "—",
    "Supprimer…",
  ]);
  const files = entries[1];
  if (!files || isSeparator(files) || !("onSelect" in files)) throw new Error("expected an action");
  files.onSelect();
  expect(a.files).toHaveBeenCalledTimes(1);
});

test("without a files action (the Inbox) the entry is absent", () => {
  const entries = projectMenuEntries({ editable: true, texts, actions: { ...actions(), files: null } });
  expect(entries.some((e) => !isSeparator(e) && e.label === "Fichiers du projet…")).toBe(false);
});

test("a project without a Planning page offers to add it right after the new page", () => {
  const planning = mock(() => {});
  const entries = projectMenuEntries({ editable: true, texts, actions: { ...actions(), planning } });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label)).slice(0, 2)).toEqual([
    "Nouvelle page",
    "Ajouter la page Planning",
  ]);
  const add = entries[1];
  if (!add || isSeparator(add) || !("onSelect" in add)) throw new Error("expected an action");
  add.onSelect();
  expect(planning).toHaveBeenCalledTimes(1);
});

test("a read-only project never offers the Planning page", () => {
  const entries = projectMenuEntries({
    editable: false,
    texts,
    actions: { ...actions(), planning: mock(() => {}) },
  });
  expect(entries.some((e) => !isSeparator(e) && e.label === "Ajouter la page Planning")).toBe(false);
});
