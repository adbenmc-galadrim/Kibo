import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { type BubbleAnchor, BubbleMenu } from "./editor/BubbleMenu";
import type { Command } from "./editor/commands";
import { EditorToolbar } from "./editor/EditorToolbar";
import { editorHighlight } from "./editor/highlight";
import { editorKeymap } from "./editor/keymap";
import { livePreview } from "./editor/live-preview";
import { slashMenu } from "./editor/slash-menu";
import { fr } from "./fr";

type Props = { value: string; onChange(markdown: string): void };

const fromValue = Annotation.define<boolean>();

const bubbleAnchor = (view: EditorView, frame: HTMLElement): BubbleAnchor | null => {
  const { from, to } = view.state.selection.main;
  if (from === to || !view.hasFocus) return null;
  const coords = view.coordsAtPos(from);
  if (!coords) return { left: 0, top: 0 };
  const box = frame.getBoundingClientRect();
  return { left: coords.left - box.left, top: coords.top - box.top };
};

const bubbleMeasure = {};

const sameAnchor = (a: BubbleAnchor | null, b: BubbleAnchor | null): boolean =>
  a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top);

const editorTheme = EditorView.theme({
  "&": { fontSize: "14px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-sans)", lineHeight: "1.6", caretColor: "currentColor" },
  ".cm-code-line": { fontFamily: "var(--font-mono)", fontSize: "13px", backgroundColor: "var(--muted)" },
});

export function MarkdownEditor({ value, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const initial = useRef(value);
  const change = useRef(onChange);
  change.current = onChange;
  const [bubble, setBubble] = useState<BubbleAnchor | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          history(),
          keymap.of([...editorKeymap, ...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          editorHighlight,
          livePreview,
          slashMenu(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": fr.editor, "aria-multiline": "true" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((t) => t.annotation(fromValue))) {
              change.current(u.state.doc.toString());
            }
            if (u.selectionSet || u.docChanged || u.geometryChanged || u.focusChanged) {
              u.view.requestMeasure({
                key: bubbleMeasure,
                read: (v) => (frame.current ? bubbleAnchor(v, frame.current) : null),
                write: (next) => setBubble((prev) => (sameAnchor(prev, next) ? prev : next)),
              });
            }
          }),
          editorTheme,
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: value },
        annotations: fromValue.of(true),
      });
    }
  }, [value]);

  const run = (cmd: Command) => {
    const v = view.current;
    if (!v) return;
    const spec = cmd(v.state);
    if (!spec) return;
    v.dispatch({ ...spec, userEvent: "input" });
    v.focus();
  };
  const focusEditor = () => view.current?.focus();

  return (
    <div className="grid min-h-[60vh] grid-rows-[auto_1fr] rounded-md border bg-background text-foreground">
      <EditorToolbar run={run} focusEditor={focusEditor} />
      <div ref={frame} className="relative min-h-0">
        <div ref={host} className="h-full p-2" />
        <BubbleMenu at={bubble} run={run} />
      </div>
    </div>
  );
}
