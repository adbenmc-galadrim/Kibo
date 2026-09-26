import { expect, test } from "bun:test";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const context: PaletteContext = {
  projects: [],
  snapshots: new Map(),
  recents: [{ kind: "screen", screen: "queue" }],
  activeProjectId: null,
  activeTicketId: null,
  agents: null,
};

test("the screens are pages of the palette and open as targets", () => {
  const pages = searchItems(buildItems(context), "attente", "all").find((s) => s.group === "pages");
  expect(pages?.items.map((i) => [i.label, i.run])).toEqual([
    ["Files d'attente", { kind: "target", target: { kind: "screen", screen: "queue" } }],
  ]);
  expect(searchItems(buildItems(context), "domaines", "pages")[0]?.items[0]?.label).toBe(
    "Domaines & guidelines",
  );
  expect(searchItems(buildItems(context), "composants", "pages")[0]?.items[0]?.label).toBe("Composants");
  expect(searchItems(buildItems(context), "parametres general", "pages")[0]?.items[0]?.label).toBe("Général");
  expect(searchItems(buildItems(context), "mes tickets", "pages")[0]?.items[0]?.label).toBe("Mes tickets");
});

test("an opened screen comes back among the recents", () => {
  const recents = searchItems(buildItems(context), "", "all").find((s) => s.group === "recents");
  expect(recents?.items.map((i) => i.label)).toEqual(["Files d'attente"]);
});
