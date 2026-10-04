import type { NoteContent, NotesInfo } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { bytesToBase64 } from "@kibo/sdk/lib/base64";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Eye, FileText, Pencil, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { SaveState } from "./autosave";
import { fr } from "./fr";
import { MarkdownEditor } from "./MarkdownEditor";
import { renderNote, type TicketRef } from "./markdown";

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

const PROSE =
  "grid gap-3 text-sm text-muted-foreground leading-relaxed [&_a]:text-foreground [&_a]:underline [&_code]:font-mono [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_img]:max-w-full [&_img]:rounded-md [&_li]:ml-1 [&_li]:list-['•_'] [&_li]:list-inside [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-foreground";

function RenderedNote({
  html,
  onTicket,
  onNote,
}: {
  html: string;
  onTicket(key: string): void;
  onNote(target: string): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const sdk = useSdk();
  const notesApi = useRef(sdk.notes);
  notesApi.current = sdk.notes;
  const handlers = useRef({ onTicket, onNote });
  handlers.current = { onTicket, onNote };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const chip = target?.closest<HTMLElement>("[data-ticket-key]");
      if (chip) {
        handlers.current.onTicket(chip.dataset.ticketKey ?? "");
        return;
      }
      const link = target?.closest<HTMLAnchorElement>("a[data-note-href]");
      if (!link) return;
      e.preventDefault();
      handlers.current.onNote(link.dataset.noteHref ?? "");
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !html.includes("data-asset")) return;
    let live = true;
    for (const img of Array.from(el.querySelectorAll<HTMLImageElement>("img[data-asset]"))) {
      notesApi.current.asset(img.dataset.asset ?? "").then(
        ({ mime, bytes }) => {
          if (live) img.src = `data:${mime};base64,${bytesToBase64(bytes)}`;
        },
        (e: unknown) => console.error(e),
      );
    }
    return () => {
      live = false;
    };
  }, [html]);

  const inner = useMemo(() => ({ __html: html }), [html]);
  return <div ref={host} className={PROSE} dangerouslySetInnerHTML={inner} />;
}

export function NoteDocument(props: Props) {
  const { note, info, tickets, editing, draft, state } = props;
  const sdk = useSdk();
  const shownPath = shownPathOf(info, note.path);
  const html = useMemo(() => renderNote(draft, tickets), [draft, tickets]);
  const openTicket = (key: string) => {
    const t = tickets.get(key);
    if (t) sdk.openTicket(t.id);
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
        <RenderedNote html={html} onTicket={openTicket} onNote={props.onOpenNote} />
      )}
    </article>
  );
}
