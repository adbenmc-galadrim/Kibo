import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { frEditor } from "../fr-editor";
import { type Command, insertCodeBlock, insertLink, insertTable, setHeading, toggleBlock } from "./commands";

export type SlashItem = { label: string; command: Command };

const insertImage: Command = (state) => {
  const { from, to } = state.selection.main;
  const alt = frEditor.imageAlt;
  return {
    changes: { from, to, insert: `![${alt}](${frEditor.imagePath})` },
    selection: EditorSelection.range(from + 2, from + 2 + alt.length),
  };
};

export const SLASH_ITEMS: readonly SlashItem[] = [
  { label: frEditor.headingLevel(1), command: setHeading(1) },
  { label: frEditor.headingLevel(2), command: setHeading(2) },
  { label: frEditor.headingLevel(3), command: setHeading(3) },
  { label: frEditor.bullet, command: toggleBlock("bullet") },
  { label: frEditor.ordered, command: toggleBlock("ordered") },
  { label: frEditor.task, command: toggleBlock("task") },
  { label: frEditor.quote, command: toggleBlock("quote") },
  { label: frEditor.codeBlock, command: insertCodeBlock("") },
  { label: frEditor.table, command: insertTable() },
  { label: frEditor.link, command: insertLink },
  { label: frEditor.image, command: insertImage },
];

const SLASH_WORD = /^\s*\/[\p{L}\d-]*$/u;
const QUERY = /^[\p{L}\d-]*$/u;

const applyItem =
  (item: SlashItem) =>
  (view: EditorView, _completion: unknown, from: number, to: number): void => {
    view.dispatch({ changes: { from: from - 1, to, insert: "" } });
    const spec = item.command(view.state);
    if (spec) view.dispatch({ ...spec, userEvent: "input" });
  };

export function slashCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.sliceDoc(line.from, context.pos);
  if (!SLASH_WORD.test(before)) return null;
  return {
    from: line.from + before.indexOf("/") + 1,
    validFor: QUERY,
    options: SLASH_ITEMS.map((item) => ({ label: item.label, apply: applyItem(item) })),
  };
}

export const slashMenu = () =>
  autocompletion({ override: [slashCompletions], activateOnTyping: true, icons: false });
