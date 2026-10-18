import { expect, test } from "bun:test";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const context: PaletteContext = {
  projects: [],
  snapshots: new Map(),
  recents: [{ kind: "screen", screen: "inbox" }],
  activeProjectId: null,
  activeTicketId: null,
  agents: null,
  executionShown: true,
};

test("the tracking screens are pages of the palette and open as targets", () => {
  const pages = searchItems(buildItems(context), "boite", "all").find((s) => s.group === "pages");
  expect(pages?.items.map((i) => [i.label, i.run])).toEqual([
    ["Boîte de réception", { kind: "target", target: { kind: "screen", screen: "inbox" } }],
  ]);
  expect(searchItems(buildItems(context), "parametres general", "pages")[0]?.items[0]?.label).toBe("Général");
  expect(searchItems(buildItems(context), "integrations", "pages")[0]?.items[0]?.label).toBe("Intégrations");
  expect(searchItems(buildItems(context), "mes tickets", "pages")[0]?.items[0]?.label).toBe("Mes tickets");
});

test("the agent-era screens are gone from the palette, even when execution was shown", () => {
  const screens = buildItems(context).flatMap((i) =>
    i.run.kind === "target" && i.run.target.kind === "screen" ? [i.run.target.screen] : [],
  );
  for (const retired of ["agents", "queue", "skills", "creations", "components", "sources", "domains"])
    expect(screens).not.toContain(retired);
  for (const query of ["attente", "skills", "creations", "composants", "domaines", "sources"])
    expect(searchItems(buildItems(context), query, "pages")).toEqual([]);
});

test("an opened screen comes back among the recents, a retired one does not", () => {
  const recents = (ctx: PaletteContext) =>
    searchItems(buildItems(ctx), "", "all")
      .find((s) => s.group === "recents")
      ?.items.map((i) => i.label);
  expect(recents(context)).toEqual(["Boîte de réception"]);
  expect(recents({ ...context, recents: [{ kind: "screen", screen: "queue" }] })).toBeUndefined();
});
