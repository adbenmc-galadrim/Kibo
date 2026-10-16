import { expect, test } from "bun:test";
import { EMPTY_TABS, type TabTarget } from "@kibo/schema";
import { showTabBar } from "./tab-bar";

const target: TabTarget = { kind: "project", projectId: "kibo" };
const tab = (id: string) => ({ id, target, pinned: false, preview: false });

test("the tab bar stays hidden while at most one tab is open", () => {
  expect(showTabBar(EMPTY_TABS, null)).toBe(false);
  expect(showTabBar({ tabs: [tab("a")] }, null)).toBe(false);
});

test("it comes back with the second tab or with an error to show", () => {
  expect(showTabBar({ tabs: [tab("a"), tab("b")] }, null)).toBe(true);
  expect(showTabBar(EMPTY_TABS, "Impossible d'enregistrer les onglets.")).toBe(true);
});
