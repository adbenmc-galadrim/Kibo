import { KiboError, type NoteContent, type NoteMeta, type NotesInfo } from "@kibo/schema";
import { useEntities, useReadOnly, useSdk } from "@kibo/sdk";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fr } from "./fr";
import type { TicketRef } from "./markdown";
import { NoteDocument } from "./NoteDocument";
import { type Backlink, type LinkedTicket, NoteLinks } from "./NoteLinks";
import { NoteList } from "./NoteList";
import { NoteTitleDialog } from "./NoteTitleDialog";
import { createdPath } from "./note-name";
import { groupNotes, type NoteSort, readNoteSort, writeNoteSort } from "./note-sort";
import { RenameNoteDialog } from "./RenameNoteDialog";
import { useNoteSession } from "./use-note-session";

function resolveTarget(target: string, notes: NoteMeta[]): string | null {
  const clean = target.replace(/^\.\//, "");
  const withExt = clean.endsWith(".md") ? clean : `${clean}.md`;
  const exact = notes.find((n) => n.path === withExt);
  if (exact) return exact.path;
  const base = withExt.split("/").pop() ?? withExt;
  const byName = notes
    .filter((n) => n.path.split("/").pop() === base)
    .sort((a, b) => a.path.length - b.path.length);
  return byName[0]?.path ?? null;
}

function backlinksOf(note: NoteContent, notes: NoteMeta[]): Backlink[] {
  return notes
    .map((n) => ({ note: n, count: n.links.filter((l) => l === note.path).length }))
    .filter((b) => b.count > 0 && b.note.path !== note.path);
}

function linkedOf(note: NoteContent, tickets: ReadonlyMap<string, TicketRef>): LinkedTicket[] {
  return note.tickets.flatMap((key) => {
    const t = tickets.get(key);
    return t ? [{ key, ...t }] : [];
  });
}

function useSearch(query: string, onError: (e: unknown) => void): NoteMeta[] | null {
  const sdk = useSdk();
  const [found, setFound] = useState<NoteMeta[] | null>(null);
  const report = useRef(onError);
  report.current = onError;
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setFound(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      sdk.notes.search(q).then(
        (r) => live && setFound(r),
        (e: unknown) => report.current(e),
      );
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [sdk, query]);
  return found;
}

export function NotesView() {
  const sdk = useSdk();
  const listed = useEntities("note");
  const readOnly = useReadOnly();
  const ticketList = useEntities("ticket");
  const [info, setInfo] = useState<NotesInfo | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<NoteSort>(readNoteSort);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<NoteMeta | null>(null);
  const [removing, setRemoving] = useState<NoteMeta | null>(null);

  const fail = useCallback((message: string) => {
    return (e: unknown) => {
      console.error(e);
      setError(message);
    };
  }, []);
  const found = useSearch(query, fail(fr.loadFailed));
  const tickets = useMemo(
    () =>
      new Map<string, TicketRef>(
        ticketList.data.flatMap((t): [string, TicketRef][] =>
          t.key === null ? [] : [[t.key, { id: t.id, title: t.title, statusId: t.statusId }]],
        ),
      ),
    [ticketList.data],
  );
  const groups = useMemo(() => groupNotes(found ?? listed.data, sort), [found, listed.data, sort]);
  const notes = useMemo(() => groups.flatMap((g) => g.notes), [groups]);
  const first = useMemo(() => groupNotes(listed.data, sort)[0]?.notes[0] ?? null, [listed.data, sort]);

  useEffect(() => {
    sdk.notes.info().then(setInfo, fail(fr.loadFailed));
  }, [sdk, fail]);

  useEffect(() => {
    if (selected === null && first) setSelected(first.path);
  }, [selected, first]);

  const { note, draft, state, load, rename, remove, change, keepMine } = useNoteSession({
    selected,
    select: setSelected,
    listed: listed.data,
    fail,
  });

  useEffect(() => {
    const current = listed.data.find((n) => n.path === selected);
    if (current && note && current.mtime !== note.mtime && state === "saved" && !editing) {
      void load(current.path);
    }
  }, [listed.data, selected, note, state, editing, load]);

  const create = async (path: string, title: string) => {
    await sdk.notes.create(path, `# ${title}\n`);
    setQuery("");
    setSelected(path);
    setEditing(true);
  };

  const nextAfter = (path: string): string | null => {
    const paths = notes.map((n) => n.path);
    const i = paths.indexOf(path);
    return paths[i + 1] ?? paths[i - 1] ?? null;
  };

  const removeNote = async (meta: NoteMeta) => {
    const next = nextAfter(meta.path);
    if (await remove(meta.path)) setSelected(next);
  };

  const byPath = (path: string) => listed.data.find((n) => n.path === path) ?? null;

  const open = (path: string) => {
    setEditing(false);
    setSelected(path);
  };

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <NoteList
        groups={groups}
        info={info}
        selected={selected}
        query={query}
        sort={sort}
        onQuery={setQuery}
        onSort={(next) => {
          setSort(next);
          writeNoteSort(next);
        }}
        onSelect={open}
        onCreate={() => setCreating(true)}
        readOnly={readOnly}
        onRename={(path) => setRenaming(byPath(path))}
        onRemove={(path) => setRemoving(byPath(path))}
      />
      <main className="min-w-0 flex-1 overflow-auto">
        {error && (
          <p role="alert" className="px-8 pt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {note ? (
          <NoteDocument
            note={note}
            info={info}
            tickets={tickets}
            editing={editing}
            draft={draft}
            state={state}
            onToggleEdit={() => setEditing((v) => !v)}
            onChange={change}
            onReload={() => void load(note.path)}
            onKeepMine={keepMine}
            onOpenNote={(target) => {
              const path = resolveTarget(target, listed.data);
              if (path) open(path);
            }}
          />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted-foreground">{fr.pick}</p>
        )}
      </main>
      <NoteLinks
        linked={note ? linkedOf(note, tickets) : []}
        backlinks={note ? backlinksOf(note, listed.data) : []}
        onTicket={(id) => sdk.openTicket(id)}
        onNote={open}
      />
      {creating && (
        <NoteTitleDialog
          title={fr.createTitle}
          initial=""
          confirmLabel={fr.createConfirm}
          pathFor={createdPath}
          unchanged={null}
          submit={create}
          describeError={(e) =>
            e instanceof KiboError && e.code === "CONFLICT" ? fr.renameConflict : fr.createFailed
          }
          onClose={() => setCreating(false)}
        />
      )}
      {renaming && <RenameNoteDialog note={renaming} onRename={rename} onClose={() => setRenaming(null)} />}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.title)}
          description={fr.removeHelp(removing.path.slice(removing.path.lastIndexOf("/") + 1))}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={() => removeNote(removing)}
          describeError={() => fr.removeFailed}
        />
      )}
    </div>
  );
}
