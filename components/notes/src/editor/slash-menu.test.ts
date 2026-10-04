import { expect, test } from "bun:test";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { SLASH_ITEMS, slashCompletions } from "./slash-menu";

const at = (doc: string, pos: number) => new CompletionContext(EditorState.create({ doc }), pos, true);

test("a slash at the start of a block offers every block item, filtered by the word after it", () => {
  const all = slashCompletions(at("texte\n/", 7));
  expect(all?.from).toBe(7);
  expect(all?.options.map((o) => o.label)).toEqual(SLASH_ITEMS.map((i) => i.label));
  expect(SLASH_ITEMS.map((i) => i.label)).toEqual([
    "Titre 1",
    "Titre 2",
    "Titre 3",
    "Liste",
    "Liste numérotée",
    "Case à cocher",
    "Citation",
    "Bloc de code",
    "Tableau",
    "Lien",
    "Image",
  ]);
  const some = slashCompletions(at("  /tab", 6));
  expect(some?.from).toBe(3);
  expect(some?.validFor).toBeTruthy();
});

test("a slash inside a word or after text on the line is not a menu", () => {
  expect(slashCompletions(at("a/b", 2))).toBeNull();
  expect(slashCompletions(at("voir /", 6))).toBeNull();
  expect(slashCompletions(at("", 0))).toBeNull();
});

test("applying an item removes the slash word and runs its command", () => {
  const state = EditorState.create({ doc: "/case" });
  const item = SLASH_ITEMS.find((i) => i.label === "Case à cocher");
  if (!item) throw new Error("missing item");
  const cleared = state.update({ changes: { from: 0, to: 5, insert: "" } }).state;
  const spec = item.command(cleared);
  if (!spec) throw new Error("declined");
  expect(cleared.update(spec).state.doc.toString()).toBe("- [ ] ");
});
