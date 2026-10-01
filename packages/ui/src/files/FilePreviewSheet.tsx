import type { FileRef } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@kibo/sdk/ui/sheet";
import { Bot, ExternalLink, FileCode, Pencil, SquareTerminal, X } from "lucide-react";
import { useEffect } from "react";
import { fr } from "../i18n/fr";
import { relativeTime } from "../lib/relative-time";
import { isRemoteView } from "../lib/remote-view";
import { isMac } from "../lib/shortcut-label";
import { CodeLines } from "./CodeLines";
import { columnOf, splitPath } from "./file-path";
import { languageOf } from "./language";
import { useExternalOpen } from "./use-external-open";
import { type FileContentState, useFileContent } from "./use-file-content";

type Props = { fileRef: FileRef; onClose(): void; onOpenInTab(edit: boolean): void; remote?: boolean };

const isExternalShortcut = (e: KeyboardEvent) =>
  (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o";

function metadata(fileRef: FileRef, file: FileContentState): string {
  const c = file.content;
  return [
    file.worktree?.branch ? fr.file.worktree(file.worktree.branch) : null,
    languageOf(fileRef.path).label,
    c ? fr.file.lines(c.lines) : null,
    c?.modifiedAt ? fr.file.modified(relativeTime(c.modifiedAt)) : null,
    c?.dirty ? fr.file.uncommitted : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

export function FilePreviewSheet({ fileRef, onClose, onOpenInTab, remote = isRemoteView() }: Props) {
  const file = useFileContent(fileRef);
  const { dir, name } = splitPath(fileRef.path);
  const openExternal = useExternalOpen(fileRef, file.worktree?.path ?? null, file.setError);
  const c = file.content;

  useEffect(() => {
    if (remote) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isExternalShortcut(e)) return;
      e.preventDefault();
      openExternal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openExternal, remote]);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        showCloseButton={false}
        className="flex w-1/2 min-w-[min(100vw,480px)] flex-col gap-0 p-0 sm:max-w-none"
      >
        <header className="flex items-center gap-2 px-4 pt-3 pb-1.5">
          <FileCode aria-hidden className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <SheetTitle className="min-w-0 truncate font-mono text-sm font-normal">
            <span className="text-muted-foreground">{dir}</span> {name}
          </SheetTitle>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onOpenInTab(false)}>
              <ExternalLink />
              {fr.file.openInTab}
            </Button>
            {!remote && (
              <>
                <Button variant="outline" size="sm" onClick={() => onOpenInTab(true)}>
                  <Pencil />
                  {fr.file.edit}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={fr.file.external}
                  title={fr.file.external}
                  onClick={openExternal}
                >
                  <SquareTerminal />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon-sm" aria-label={fr.file.close} onClick={onClose}>
              <X />
            </Button>
          </div>
        </header>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-3 border-b px-4 pb-2.5 text-xs text-muted-foreground">
            {fileRef.origin && (
              <span className="flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                <Bot aria-hidden className="size-3.5" />
                {fr.file.origin(fileRef.origin)}
              </span>
            )}
            <span>{metadata(fileRef, file)}</span>
          </div>
        </SheetDescription>
        {file.error && (
          <p role="alert" className="px-4 py-2 text-sm text-destructive">
            {file.error}
          </p>
        )}
        {c?.binary && <p className="p-6 text-sm text-muted-foreground">{fr.file.binary}</p>}
        {c?.tooLarge && <p className="p-6 text-sm text-muted-foreground">{fr.file.tooLarge}</p>}
        {file.tokens ? (
          <CodeLines tokens={file.tokens} highlightLine={fileRef.line} label={fileRef.path} />
        ) : (
          <div className="flex-1" />
        )}
        <footer className="flex items-center justify-between border-t px-4 py-2 font-mono text-xs text-muted-foreground">
          <span>{fr.file.position(fileRef.line ?? 1, columnOf(c?.content ?? null, fileRef.line))}</span>
          <span className="font-sans">{fr.file.hints(isMac())}</span>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
