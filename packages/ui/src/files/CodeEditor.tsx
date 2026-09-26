import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { MergeView, unifiedMergeView } from "@codemirror/merge";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef, useState } from "react";
import { fr } from "../i18n/fr";
import { kiboEditorTheme } from "./editor-theme";
import { splitPath } from "./file-path";
import { useDarkMode } from "./use-dark-mode";

export type EditorLayout = "single" | "unified" | "split";

type Props = {
  initial: string;
  original: string | null;
  path: string;
  layout: EditorLayout;
  label: string;
  onChange(value: string): void;
  onSave(): void;
};

type Mounted = { views: EditorView[]; mode: Compartment; destroy(): void };

const modeOf = (dark: boolean) => EditorView.darkTheme.of(dark);

export function CodeEditor({ initial, original, path, layout, label, onChange, onSave }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onChange, onSave });
  handlers.current = { onChange, onSave };
  const doc = useRef(initial);
  const mounted = useRef<Mounted | null>(null);
  const dark = useDarkMode();
  const latestDark = useRef(dark);
  latestDark.current = dark;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const language = new Compartment();
    const mode = new Compartment();
    const shared: Extension[] = [
      basicSetup,
      kiboEditorTheme,
      mode.of(modeOf(latestDark.current)),
      language.of([]),
    ];
    const editable: Extension[] = [
      ...shared,
      EditorView.contentAttributes.of({ "aria-label": label }),
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            handlers.current.onSave();
            return true;
          },
        },
      ]),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        doc.current = u.state.doc.toString();
        handlers.current.onChange(doc.current);
      }),
    ];
    const next = createEditor(parent, doc.current, original, layout, shared, editable, mode);
    mounted.current = next;
    const description = LanguageDescription.matchFilename(languages, splitPath(path).name);
    let alive = true;
    description?.load().then(
      (support) => {
        if (!alive) return;
        for (const view of next.views) view.dispatch({ effects: language.reconfigure(support) });
      },
      () => {
        if (alive) setError(fr.file.languageFailed);
      },
    );
    return () => {
      alive = false;
      mounted.current = null;
      next.destroy();
    };
  }, [original, path, layout, label]);

  useEffect(() => {
    const current = mounted.current;
    if (!current) return;
    for (const view of current.views) view.dispatch({ effects: current.mode.reconfigure(modeOf(dark)) });
  }, [dark]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && (
        <p role="alert" className="px-4 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
      <div ref={host} className="min-h-0 flex-1 overflow-auto text-[13px]" />
    </div>
  );
}

function createEditor(
  parent: HTMLElement,
  doc: string,
  original: string | null,
  layout: EditorLayout,
  shared: Extension[],
  editable: Extension[],
  mode: Compartment,
): Mounted {
  if (layout === "split" && original !== null) {
    const merge = new MergeView({
      a: {
        doc: original,
        extensions: [...shared, EditorState.readOnly.of(true), EditorView.editable.of(false)],
      },
      b: { doc, extensions: editable },
      parent,
    });
    return { views: [merge.a, merge.b], mode, destroy: () => merge.destroy() };
  }
  const extensions =
    layout === "unified" && original !== null
      ? [...editable, unifiedMergeView({ original, mergeControls: false })]
      : editable;
  const view = new EditorView({ parent, state: EditorState.create({ doc, extensions }) });
  return { views: [view], mode, destroy: () => view.destroy() };
}
