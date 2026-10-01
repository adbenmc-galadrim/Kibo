import type { FileChange, FileRef } from "@kibo/schema";
import { useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useFlash } from "../lib/use-flash";
import { discardPaths } from "./file-menu";

type Scope = { projectId: string; worktree: string };
type Deps = {
  w: Scope;
  run(work: () => Promise<unknown>): Promise<boolean>;
  onDiscarded(): void;
  onOpenInTab(ref: FileRef): void;
};

export function useFileActions({ w, run, onDiscarded, onOpenInTab }: Deps) {
  const [discarding, setDiscarding] = useState<FileChange | null>(null);
  const copy = useFlash();
  const copyPath = async (f: FileChange) => {
    try {
      await navigator.clipboard.writeText(f.path);
      copy.flash(fr.changes.copied);
    } catch {
      copy.flash(fr.changes.copyFailed, "error");
    }
  };
  const discard = async (f: FileChange) => {
    await client.code({ method: "discardChanges", ...w, paths: discardPaths(f) });
    onDiscarded();
  };
  const handlers = {
    onOpenInTab: (f: FileChange) => onOpenInTab({ ...w, path: f.path, line: null, origin: null }),
    onOpenExternal: (f: FileChange) =>
      void run(() => client.code({ method: "openInEditor", ...w, path: f.path, line: null })),
    onCopyPath: (f: FileChange) => void copyPath(f),
    onDiscard: setDiscarding,
    onStageAll: () => void run(() => client.code({ method: "stageAll", ...w })),
    onUnstageAll: () => void run(() => client.code({ method: "unstageAll", ...w })),
  };
  return { handlers, copy, discarding, closeDiscard: () => setDiscarding(null), discard };
}
