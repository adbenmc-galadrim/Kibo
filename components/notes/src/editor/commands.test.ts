import { expect, test } from "bun:test";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  type Command,
  insertCodeBlock,
  insertLink,
  insertTable,
  setHeading,
  toggleBlock,
  toggleInline,
  toggleTaskAt,
} from "./commands";

const state = (doc: string, from: number, to = from) =>
  EditorState.create({ doc, selection: EditorSelection.single(from, to) });
const apply = (s: EditorState, cmd: Command): EditorState => {
  const spec = cmd(s);
  if (!spec) throw new Error("command declined");
  return s.update(spec).state;
};
const sel = (s: EditorState) => [s.selection.main.from, s.selection.main.to];

test("bold wraps the selection, keeps it on the text, and unwraps on the second call", () => {
  const bold = apply(state("un mot ici", 3, 6), toggleInline("bold"));
  expect(bold.doc.toString()).toBe("un **mot** ici");
  expect(sel(bold)).toEqual([5, 8]);
  expect(apply(bold, toggleInline("bold")).doc.toString()).toBe("un mot ici");
  const inner = apply(state("un **mot** ici", 3, 10), toggleInline("bold"));
  expect(inner.doc.toString()).toBe("un mot ici");
});

test("italic, strike and code use their own marks; an empty selection gets a placeholder", () => {
  expect(apply(state("a b", 2, 3), toggleInline("italic")).doc.toString()).toBe("a *b*");
  expect(apply(state("a b", 2, 3), toggleInline("strike")).doc.toString()).toBe("a ~~b~~");
  expect(apply(state("a b", 2, 3), toggleInline("code")).doc.toString()).toBe("a `b`");
  const empty = apply(state("", 0), toggleInline("bold"));
  expect(empty.doc.toString()).toBe("**texte**");
  expect(sel(empty)).toEqual([2, 7]);
});

test("headings replace each other, level 0 removes the mark, every selected line changes", () => {
  const h2 = apply(state("Titre\ntexte", 0), setHeading(2));
  expect(h2.doc.toString()).toBe("## Titre\ntexte");
  expect(apply(h2, setHeading(1)).doc.toString()).toBe("# Titre\ntexte");
  expect(apply(h2, setHeading(0)).doc.toString()).toBe("Titre\ntexte");
  expect(apply(state("a\nb", 0, 3), setHeading(3)).doc.toString()).toBe("### a\n### b");
});

test("lists toggle, ordered lists count, a task replaces a bullet, a quote nests nothing", () => {
  expect(apply(state("a\nb", 0, 3), toggleBlock("bullet")).doc.toString()).toBe("- a\n- b");
  expect(apply(state("- a\n- b", 0, 7), toggleBlock("bullet")).doc.toString()).toBe("a\nb");
  expect(apply(state("a\nb", 0, 3), toggleBlock("ordered")).doc.toString()).toBe("1. a\n2. b");
  expect(apply(state("- a", 0), toggleBlock("task")).doc.toString()).toBe("- [ ] a");
  expect(apply(state("- [ ] a", 0), toggleBlock("task")).doc.toString()).toBe("a");
  expect(apply(state("a", 0), toggleBlock("quote")).doc.toString()).toBe("> a");
  expect(apply(state("> a", 0), toggleBlock("quote")).doc.toString()).toBe("a");
});

test("a code block takes the language and puts the cursor inside; a link selects its url; a table has a separator", () => {
  const code = apply(state("x", 1), insertCodeBlock("ts"));
  expect(code.doc.toString()).toBe("x\n```ts\n\n```");
  expect(sel(code)).toEqual([8, 8]);
  const wrapped = apply(state("const a = 1", 0, 11), insertCodeBlock(""));
  expect(wrapped.doc.toString()).toBe("```\nconst a = 1\n```");
  const link = apply(state("Kibo", 0, 4), insertLink);
  expect(link.doc.toString()).toBe("[Kibo](url)");
  expect(sel(link)).toEqual([7, 10]);
  const table = apply(state("", 0), insertTable(2, 1));
  expect(table.doc.toString()).toBe("| Colonne 1 | Colonne 2 |\n| --- | --- |\n|  |  |");
});

test("toggleTaskAt flips the checkbox of the line at a position", () => {
  expect(apply(state("- [ ] a\n- [x] b", 9), toggleTaskAt(9)).doc.toString()).toBe("- [ ] a\n- [ ] b");
  expect(apply(state("- [ ] a", 3), toggleTaskAt(3)).doc.toString()).toBe("- [x] a");
  expect(toggleTaskAt(0)(state("rien", 0))).toBeNull();
});

test("italic inside bold adds a third star, and each mark comes off on its own", () => {
  const both = apply(state("un **mot**", 5, 8), toggleInline("italic"));
  expect(both.doc.toString()).toBe("un ***mot***");
  expect(apply(both, toggleInline("italic")).doc.toString()).toBe("un **mot**");
  expect(apply(both, toggleInline("bold")).doc.toString()).toBe("un *mot*");
  expect(apply(state("un **mot**", 3, 10), toggleInline("italic")).doc.toString()).toBe("un ***mot***");
});
