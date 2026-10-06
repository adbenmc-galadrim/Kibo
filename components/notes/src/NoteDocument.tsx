import type { NoteContent, NotesInfo } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Eye, FileText, Pencil, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import type { SaveState } from "./autosave";
import { fr } from "./fr";
import { MarkdownEditor } from "./MarkdownEditor";
import { renderNote, type TicketRef } from "./markdown";
import { PROSE } from "./markdown-styles";
import { RenderedMarkdown } from "./RenderedMarkdown";
import { toggleTaskLine } from "./task-lines";

export function NoteConflictBanner({ onReload, onKeepMine }: { onReload(): void; onKeepMine(): void }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm"
    >
      <TriangleAlert aria-hidden className="size-4 text-amber-600 dark:text-amber-400" />
      <span className="flex-1">{fr.conflict}</span>
      <Button size="sm" variant="outline" onClick={onReload}>
        {fr.reload}
      </Button>
      <Button size="sm" onClick={onKeepMine}>
        {fr.keepMine}
      </Button>
    </div>
  );
}

type Props = {
  note: NoteContent;
  info: NotesInfo | null;
  tickets: ReadonlyMap<string, TicketRef>;
  editing: boolean;
  draft: string;
  state: SaveState;
  onToggleEdit(): void;
  onChange(markdown: string): void;
  onPasteImage(file: File): Promise<string | null>;
  onReload(): void;
  onKeepMine(): void;
  onOpenNote(target: string): void;
};

const stateLabel = (s: SaveState) => {
  if (s === "saved") return `${fr.saved} • ${fr.local}`;
  if (s === "saving") return fr.saving;
  if (s === "error") return fr.saveFailed;
  return fr.unsaved;
};

const shownPathOf = (info: NotesInfo | null, path: string) => {
  const folder = info?.folderRelative;
  if (folder === null || folder === undefined) return null;
  return folder === "." || folder === "" ? path : `${folder}/${path}`;
};

export function NoteDocument(props: Props) {
  const { note, info, tickets, editing, draft, state } = props;
  const sdk = useSdk();
  const shownPath = shownPathOf(info, note.path);
  const html = useMemo(() => renderNote(draft, tickets), [draft, tickets]);
  const openTicket = (key: string) => {
    const t = tickets.get(key);
    if (t) sdk.openTicket(t.id);
  };
  const toggleTask = (line: number) => {
    const next = toggleTaskLine(draft, line);
    if (next !== null) props.onChange(next);
  };
  return (
    <article className="mx-auto grid w-full max-w-2xl content-start gap-4 px-8 py-6">
      <div className="flex items-center gap-2 text-xs">
        <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        {shownPath ? (
          <button
            type="button"
            className="truncate font-mono text-blue-600 underline underline-offset-2 dark:text-blue-400"
            onClick={() => sdk.openFile({ path: shownPath })}
          >
            {shownPath}
          </button>
        ) : (
          <span className="truncate font-mono text-muted-foreground">{note.path}</span>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" onClick={props.onToggleEdit}>
          {editing ? <Eye aria-hidden /> : <Pencil aria-hidden />}
          {editing ? fr.preview : fr.edit}
        </Button>
        <span
          role={state === "error" ? "alert" : "status"}
          className={cn(
            "shrink-0 whitespace-nowrap",
            state === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {stateLabel(state)}
        </span>
      </div>
      {state === "conflict" && <NoteConflictBanner onReload={props.onReload} onKeepMine={props.onKeepMine} />}
      {editing ? (
        <MarkdownEditor value={draft} onChange={props.onChange} onPasteImage={props.onPasteImage} />
      ) : (
        <RenderedMarkdown
          html={html}
          className={PROSE}
          onTicket={openTicket}
          onNote={props.onOpenNote}
          onTask={toggleTask}
        />
      )}
    </article>
  );
}
