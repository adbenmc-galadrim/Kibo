import { expect, test } from "bun:test";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { activeLines, codeLines, hiddenRanges, taskMarkers } from "./live-preview";

const state = (doc: string, cursor: number, head = cursor) =>
  EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
    selection: EditorSelection.single(cursor, head),
  });

test("marks are hidden everywhere except on the lines of the selection", () => {
  const doc = "# Titre\n\ndu **gras** et *italique*\n\n~~barré~~ et `code`";
  const away = hiddenRanges(state(doc, doc.length));
  expect(away).toContainEqual({ from: 0, to: 2 });
  expect(away).toContainEqual({ from: 12, to: 14 });
  expect(away).toContainEqual({ from: 18, to: 20 });
  expect(away).toContainEqual({ from: 24, to: 25 });
  expect(away).toContainEqual({ from: 33, to: 34 });
  expect(away.some((r) => r.from >= 36)).toBe(false);
  const onTitle = hiddenRanges(state(doc, 3));
  expect(onTitle.some((r) => r.from === 0)).toBe(false);
  expect(onTitle).toContainEqual({ from: 12, to: 14 });
});

test("a link keeps its text and hides its brackets and url; activeLines spans the selection", () => {
  const doc = "voir [Kibo](https://kibo.dev) ici\nautre";
  const hidden = hiddenRanges(state(doc, doc.length));
  expect(hidden).toContainEqual({ from: 5, to: 6 });
  expect(hidden).toContainEqual({ from: 10, to: 29 });
  expect(hidden.some((r) => r.from <= 6 && r.to >= 10)).toBe(false);
  expect(activeLines(state("a\nb\nc", 0, 3))).toEqual([{ from: 0, to: 3 }]);
});

test("task markers are found with their state, except on the active line", () => {
  const doc = "- [ ] faire\n- [x] fait\n- autre";
  expect(taskMarkers(state(doc, doc.length))).toEqual([
    { from: 2, to: 5, checked: false },
    { from: 14, to: 17, checked: true },
  ]);
  expect(taskMarkers(state(doc, 3))).toEqual([{ from: 14, to: 17, checked: true }]);
});

test("a fenced code block keeps its fences and its lines are listed as code", () => {
  const doc = "texte\n```ts\nconst a = 1;\n```\nfin `x`";
  const hidden = hiddenRanges(state(doc, 0));
  expect(hidden.some((r) => r.from >= 6 && r.to <= 28)).toBe(false);
  expect(hidden).toContainEqual({ from: 33, to: 34 });
  expect(hidden).toContainEqual({ from: 35, to: 36 });
  expect(codeLines(state(doc, 0))).toEqual([6, 12, 25]);
});
