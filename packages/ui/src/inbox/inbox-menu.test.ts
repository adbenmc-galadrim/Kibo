import { expect, mock, test } from "bun:test";
import { isSeparator } from "@kibo/sdk/ui/menu-entries";
import { frInbox } from "../i18n/fr-inbox";
import { inboxMenuEntries } from "./inbox-menu";

test("an inbox ticket offers open, file, then a destructive remove after a separator", () => {
  const actions = { open: mock(() => {}), file: mock(() => {}), remove: mock(() => {}) };
  const entries = inboxMenuEntries({ texts: frInbox, actions });
  expect(entries.map((e) => (isSeparator(e) ? "—" : e.label))).toEqual([
    "Ouvrir",
    "Rattacher à un projet…",
    "—",
    "Supprimer…",
  ]);
  for (const entry of entries) if (!isSeparator(entry) && "onSelect" in entry) entry.onSelect();
  const last = entries[3];
  if (!last || isSeparator(last) || !("onSelect" in last)) throw new Error("expected an action");
  expect(last.destructive).toBe(true);
  expect([actions.open, actions.file, actions.remove].map((a) => a.mock.calls.length)).toEqual([1, 1, 1]);
});
