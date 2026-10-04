import { expect, test } from "bun:test";
import { shortcutGroups } from "./shortcuts";

test("groups follow screen 77, with platform labels", () => {
  const mac = shortcutGroups(true);
  expect(mac.map((g) => g.title)).toEqual(["Navigation", "Palette", "Code"]);
  expect(mac[0]?.items.map((i) => [i.label, i.keys, i.range ?? false])).toEqual([
    ["Palette de commandes", ["⌘K"], false],
    ["Nouvel onglet (palette)", ["⌘T"], false],
    ["Fermer l'onglet", ["⌘W"], false],
    ["Rouvrir le dernier onglet fermé", ["⌘⇧T"], false],
    ["Épingler ou détacher l'onglet", ["⌘⇧P"], false],
    ["Aller à l'Accueil", ["⌘1"], false],
    ["Aller à un onglet", ["⌘2", "⌘8"], true],
    ["Dernier onglet", ["⌘9"], false],
  ]);
  expect(mac[1]?.items.map((i) => i.keys)).toEqual([["↵"], ["⌘↵"], ["Tab"]]);
  expect(mac[2]?.items.map((i) => i.keys)).toEqual([["⌘S"], ["⌘⇧O"], ["⌘↵"]]);
  const pc = shortcutGroups(false);
  expect(pc[0]?.items[0]?.keys).toEqual(["Ctrl+K"]);
  expect(pc[0]?.items[6]?.keys).toEqual(["Ctrl+2", "Ctrl+8"]);
  expect(pc[1]?.items.map((i) => i.keys)).toEqual([["↵"], ["Ctrl+↵"], ["Tab"]]);
});
