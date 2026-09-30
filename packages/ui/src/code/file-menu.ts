import type { FileChange } from "@kibo/schema";
import type { MenuEntry } from "@kibo/sdk/ui/menu-entries";
import { Copy, ExternalLink, FileDiff, Minus, Plus, SquareArrowOutUpRight, Undo2 } from "lucide-react";
import type { frCode } from "../i18n/fr-code";

export type FileMenuTexts = typeof frCode.changes;
export type FileMenuActions = {
  viewDiff(): void;
  openInTab(): void;
  openExternal(): void;
  copyPath(): void;
  toggleStage(): void;
  discard(): void;
};
type Input = { file: FileChange; readOnly: boolean; texts: FileMenuTexts; actions: FileMenuActions };

export const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const NEW_KINDS = new Set<FileChange["kind"]>(["untracked", "added"]);

export function fileMenuEntries({ file, readOnly, texts, actions }: Input): MenuEntry[] {
  const view: MenuEntry = { label: texts.viewDiff, icon: FileDiff, onSelect: actions.viewDiff };
  const openInTab: MenuEntry = { label: texts.openInTab, icon: ExternalLink, onSelect: actions.openInTab };
  const copyPath: MenuEntry = { label: texts.copyPath, icon: Copy, onSelect: actions.copyPath };
  if (readOnly) return [view, openInTab, copyPath];
  const entries: MenuEntry[] = [
    view,
    openInTab,
    { label: texts.openExternal, icon: SquareArrowOutUpRight, onSelect: actions.openExternal },
    copyPath,
  ];
  if (file.kind === "conflicted") return entries;
  const staged = file.area === "staged";
  return [
    ...entries,
    { separator: true },
    {
      label: staged ? texts.unstage : texts.stage,
      icon: staged ? Minus : Plus,
      onSelect: actions.toggleStage,
    },
    { separator: true },
    { label: texts.discard, icon: Undo2, destructive: true, onSelect: actions.discard },
  ];
}

export function discardPaths(file: FileChange): string[] {
  return file.origPath ? [file.path, file.origPath] : [file.path];
}

export function discardLines(file: FileChange, texts: FileMenuTexts): string[] {
  if (file.origPath) return [texts.discardRenamed(basename(file.origPath), basename(file.path))];
  if (NEW_KINDS.has(file.kind)) return [texts.discardDeleted(basename(file.path))];
  return [texts.discardRestored(basename(file.path))];
}
