import type { EditorView, KeyBinding } from "@codemirror/view";
import { type Command, toggleInline } from "./commands";

export const runCommand =
  (cmd: Command) =>
  (view: EditorView): boolean => {
    const spec = cmd(view.state);
    if (!spec) return false;
    view.dispatch({ ...spec, userEvent: "input" });
    return true;
  };

export const editorKeymap: readonly KeyBinding[] = [
  { key: "Mod-b", run: runCommand(toggleInline("bold")) },
  { key: "Mod-i", run: runCommand(toggleInline("italic")) },
  { key: "Mod-e", run: runCommand(toggleInline("code")) },
];
