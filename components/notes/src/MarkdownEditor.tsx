import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { Command } from "./editor/commands";
import { EditorToolbar } from "./editor/EditorToolbar";
import { editorKeymap } from "./editor/keymap";
import { fr } from "./fr";

type Props = { value: string; onChange(markdown: string): void };

const fromValue = Annotation.define<boolean>();

const editorTheme = EditorView.theme({
  "&": { fontSize: "14px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-mono)", caretColor: "currentColor" },
});

export function MarkdownEditor({ value, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const initial = useRef(value);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          history(),
          keymap.of([...editorKeymap, ...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": fr.editor, "aria-multiline": "true" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((t) => t.annotation(fromValue))) {
              change.current(u.state.doc.toString());
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
      <div ref={host} className="min-h-0 p-2" />
    </div>
  );
}
