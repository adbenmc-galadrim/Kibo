import { expect, test } from "bun:test";
import type { NoteMeta } from "@kibo/schema";
import { groupNotes } from "./note-sort";

const note = (path: string, title: string, mtime: number): NoteMeta => ({
  path,
  title,
  mtime,
  size: 0,
  tickets: [],
  links: [],
});

const notes = [
  note("reunions/kick-off.md", "Kick-off", 5),
  note("journal.md", "Journal", 1),
  note("idees/widgets.md", "Widgets", 2),
  note("archives.md", "Archives", 3),
  note("idees/export.md", "Écrans", 9),
  note("idees/vieux/brouillon.md", "Brouillon", 4),
];

const shape = (sort: "recent" | "title") =>
  groupNotes(notes, sort).map((g) => [g.dir, g.notes.map((n) => n.title)]);

test("the root comes first, then folders by name; recent sorts by modification, newest first", () => {
  expect(shape("recent")).toEqual([
    ["", ["Archives", "Journal"]],
    ["idees", ["Écrans", "Brouillon", "Widgets"]],
    ["reunions", ["Kick-off"]],
  ]);
});

test("title sorts each group alphabetically, accents included", () => {
  expect(shape("title")).toEqual([
    ["", ["Archives", "Journal"]],
    ["idees", ["Brouillon", "Écrans", "Widgets"]],
    ["reunions", ["Kick-off"]],
  ]);
});

test("without a root note, the first group is a folder; no note gives no group", () => {
  expect(groupNotes(notes.slice(0, 1), "recent").map((g) => g.dir)).toEqual(["reunions"]);
  expect(groupNotes([], "title")).toEqual([]);
});
