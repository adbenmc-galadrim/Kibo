import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { toggleTaskAt } from "./commands";
import { TaskWidget } from "./task-widget";

export type Range = { from: number; to: number };
export type TaskMarker = Range & { checked: boolean };

const HIDDEN = new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark", "LinkMark"]);
const LINK_PARENTS = new Set(["Link", "Image"]);
const PARSE_BUDGET_MS = 50;

export function activeLines(state: EditorState): Range[] {
  return state.selection.ranges.map((r) => ({
    from: state.doc.lineAt(r.from).from,
    to: state.doc.lineAt(r.to).to,
  }));
}

const touches = (ranges: readonly Range[], from: number, to: number): boolean =>
  ranges.some((r) => from <= r.to && to >= r.from);

const tree = (state: EditorState) =>
  ensureSyntaxTree(state, state.doc.length, PARSE_BUDGET_MS) ?? syntaxTree(state);

export function hiddenRanges(state: EditorState): Range[] {
  const active = activeLines(state);
  const out: Range[] = [];
  tree(state).iterate({
    enter: (node) => {
      const parent = node.node.parent?.name ?? "";
      const url = node.name === "URL" && LINK_PARENTS.has(parent);
      const inlineCode = node.name === "CodeMark" && parent === "InlineCode";
      if (!HIDDEN.has(node.name) && !url && !inlineCode) return;
      if (touches(active, node.from, node.to)) return;
      const trailingSpace =
        node.name === "HeaderMark" && state.sliceDoc(node.to, node.to + 1) === " " ? 1 : 0;
      out.push({ from: node.from, to: node.to + trailingSpace });
    },
  });
  return mergeAdjacent(out.sort((a, b) => a.from - b.from));
}

const mergeAdjacent = (sorted: readonly Range[]): Range[] =>
  sorted.reduce<Range[]>((acc, r) => {
    const last = acc.at(-1);
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
    else acc.push({ ...r });
    return acc;
  }, []);

export function taskMarkers(state: EditorState): TaskMarker[] {
  const active = activeLines(state);
  const out: TaskMarker[] = [];
  tree(state).iterate({
    enter: (node) => {
      if (node.name !== "TaskMarker" || touches(active, node.from, node.to)) return;
      out.push({ from: node.from, to: node.to, checked: /x/i.test(state.sliceDoc(node.from, node.to)) });
    },
  });
  return out;
}

export function codeLines(state: EditorState): number[] {
  const out: number[] = [];
  tree(state).iterate({
    enter: (node) => {
      if (node.name !== "FencedCode") return;
      const last = state.doc.lineAt(node.to).number;
      for (let n = state.doc.lineAt(node.from).number; n <= last; n++) out.push(state.doc.line(n).from);
      return false;
    },
  });
  return out;
}

const codeLine = Decoration.line({ class: "cm-code-line" });

const build = (state: EditorState): DecorationSet =>
  Decoration.set(
    [
      ...codeLines(state).map((from) => codeLine.range(from)),
      ...hiddenRanges(state).map((r) => Decoration.replace({}).range(r.from, r.to)),
      ...taskMarkers(state).map((m) =>
        Decoration.replace({ widget: new TaskWidget(m.checked) }).range(m.from, m.to),
      ),
    ],
    true,
  );

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view.state);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = build(u.state);
    }
  },
  { decorations: (v) => v.decorations },
);

const clicks = EditorView.domEventHandlers({
  mousedown(e, view) {
    const target = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>("[data-task]") : null;
    if (!target) return false;
    const spec = toggleTaskAt(view.posAtDOM(target))(view.state);
    if (spec) view.dispatch({ ...spec, userEvent: "input" });
    e.preventDefault();
    return true;
  },
});

export const livePreview: Extension = [plugin, clicks];
