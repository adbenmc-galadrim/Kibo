import { expect, test } from "bun:test";
import { type FlatItem, moveFocus } from "./folder-tree-keys";

const items: FlatItem[] = [
  { key: "ws", parent: null, label: "Workspace", expanded: true },
  { key: "conv", parent: "ws", label: "conventions.md", expanded: null },
  { key: "kibo", parent: null, label: "Kibo", expanded: true },
  { key: "kibo.md", parent: "kibo", label: "kibo.md", expanded: null },
  { key: "fac", parent: null, label: "Facturation", expanded: false },
  { key: "por", parent: null, label: "Portail", expanded: false },
];

test("arrows walk the visible items and stop at the ends", () => {
  expect(moveFocus(items, "ws", "ArrowDown")).toEqual({ focus: "conv" });
  expect(moveFocus(items, "conv", "ArrowUp")).toEqual({ focus: "ws" });
  expect(moveFocus(items, "ws", "ArrowUp")).toBeNull();
  expect(moveFocus(items, "por", "ArrowDown")).toBeNull();
});

test("Home and End jump to the first and last items", () => {
  expect(moveFocus(items, "kibo", "Home")).toEqual({ focus: "ws" });
  expect(moveFocus(items, "kibo", "End")).toEqual({ focus: "por" });
});

test("right opens a closed folder, then enters it; left closes it, then goes up", () => {
  expect(moveFocus(items, "fac", "ArrowRight")).toEqual({ expand: "fac" });
  expect(moveFocus(items, "kibo", "ArrowRight")).toEqual({ focus: "kibo.md" });
  expect(moveFocus(items, "kibo.md", "ArrowRight")).toBeNull();
  expect(moveFocus(items, "kibo", "ArrowLeft")).toEqual({ collapse: "kibo" });
  expect(moveFocus(items, "kibo.md", "ArrowLeft")).toEqual({ focus: "kibo" });
  expect(moveFocus(items, "fac", "ArrowLeft")).toBeNull();
});

test("a letter moves to the next item starting with it, wrapping, accents ignored", () => {
  expect(moveFocus(items, "ws", "k")).toEqual({ focus: "kibo" });
  expect(moveFocus(items, "kibo", "K")).toEqual({ focus: "kibo.md" });
  expect(moveFocus(items, "kibo.md", "k")).toEqual({ focus: "kibo" });
  expect(moveFocus(items, "ws", "f")).toEqual({ focus: "fac" });
  expect(moveFocus(items, "ws", "z")).toBeNull();
  expect(moveFocus(items, "ws", "Tab")).toBeNull();
  const accents: FlatItem[] = [
    { key: "a", parent: null, label: "Agents", expanded: null },
    { key: "d", parent: null, label: "Démon", expanded: null },
  ];
  expect(moveFocus(accents, "a", "d")).toEqual({ focus: "d" });
});
