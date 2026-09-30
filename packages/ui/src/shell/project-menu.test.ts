import { expect, mock, test } from "bun:test";
import { isSeparator } from "@kibo/sdk/ui/menu-entries";
import { projectMenuEntries } from "./project-menu";

const texts = { newPage: "Nouvelle page", share: "Partager", edit: "Modifier…", remove: "Supprimer…" };
const actions = () => ({
  newPage: mock(() => {}),
  share: mock(() => {}),
  edit: mock(() => {}),
  remove: mock(() => {}),
});

test("an editable project offers new page, share, edit, then delete after a separator", () => {
  const a = actions();
  const entries = projectMenuEntries({ editable: true, texts, actions: a });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label))).toEqual([
    "Nouvelle page",
    "Partager",
    "Modifier…",
    "—",
    "Supprimer…",
  ]);
  const last = entries[4];
  if (!last || isSeparator(last) || !("onSelect" in last)) throw new Error("expected an action");
  expect(last.destructive).toBe(true);
  last.onSelect();
  expect(a.remove).toHaveBeenCalledTimes(1);
});

test("a read-only project keeps share and delete only", () => {
  const entries = projectMenuEntries({ editable: false, texts, actions: actions() });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label))).toEqual(["Partager", "—", "Supprimer…"]);
});
