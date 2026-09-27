import type { NoteContent, NoteMeta, NotesInfo } from "@kibo/schema";
import { useEntities, useReadOnly, useSdk } from "@kibo/sdk";
import { ConfirmDialog } from "@kibo/sdk/ui/confirm-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Autosave, createAutosave, type SaveState } from "./autosave";
import { fr } from "./fr";
import type { TicketRef } from "./markdown";
import { NoteDocument } from "./NoteDocument";
import { type Backlink, type LinkedTicket, NoteLinks } from "./NoteLinks";
import { NoteList } from "./NoteList";
import { autoRenameTarget } from "./note-name";
import { RenameNoteDialog } from "./RenameNoteDialog";

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

function freePath(notes: NoteMeta[]): string {
  const taken = new Set(notes.map((n) => n.path));
  for (let i = 1; ; i += 1) {
    const path = i === 1 ? "sans-titre.md" : `sans-titre-${i}.md`;
    if (!taken.has(path)) return path;
  }
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
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<NoteContent | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<NoteMeta | null>(null);
  const [removing, setRemoving] = useState<NoteMeta | null>(null);
  const autosave = useRef<Autosave | null>(null);
  const listedPaths = useRef<string[]>([]);
  listedPaths.current = listed.data.map((n) => n.path);
  const notesApi = useRef(sdk.notes);
  notesApi.current = sdk.notes;

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
  const notes = found ?? listed.data;

  useEffect(() => {
    sdk.notes.info().then(setInfo, fail(fr.loadFailed));
  }, [sdk, fail]);

  useEffect(() => {
    if (selected === null && listed.data[0]) setSelected(listed.data[0].path);
  }, [selected, listed.data]);

  const load = useCallback(
    async (path: string) => {
      try {
        const content = await notesApi.current.read(path);
        setNote(content);
        setDraft(content.markdown);
        setState("saved");
        autosave.current?.setBase(content.mtime);
      } catch (e) {
        fail(fr.loadFailed)(e);
      }
    },
    [fail],
  );

  useEffect(() => {
    if (selected === null) return;
    const a = createAutosave({
      delayMs: 800,
      save: (md, mtime) => notesApi.current.write(selected, md, mtime),
      onState: setState,
      onSaved: (meta) => {
        setNote((n) => (n && n.path === meta.path ? { ...n, ...meta } : n));
        const target = autoRenameTarget(meta, listedPaths.current);
        if (target !== null) {
          notesApi.current
            .rename(meta.path, target)
            .then((renamed) => setSelected(renamed.path), fail(fr.renameFailed));
        }
      },
    });
    autosave.current = a;
    void load(selected);
    return () => {
      autosave.current = null;
      void a.flush().finally(() => a.dispose());
    };
  }, [selected, load, fail]);

  useEffect(() => {
    const current = listed.data.find((n) => n.path === selected);
    if (current && note && current.mtime !== note.mtime && state === "saved" && !editing) {
      void load(current.path);
    }
  }, [listed.data, selected, note, state, editing, load]);

  const create = async () => {
    try {
      const path = freePath(listed.data);
      await sdk.notes.write(path, `# ${fr.untitled}\n`, null);
      setQuery("");
      setSelected(path);
      setEditing(true);
    } catch (e) {
      fail(fr.createFailed)(e);
    }
  };

  const nextAfter = (path: string): string | null => {
    const paths = notes.map((n) => n.path);
    const i = paths.indexOf(path);
    return paths[i + 1] ?? paths[i - 1] ?? null;
  };

  const remove = async (meta: NoteMeta) => {
    const next = nextAfter(meta.path);
    await sdk.notes.remove(meta.path);
    if (meta.path !== selected) return;
    setNote(null);
    setSelected(next);
  };

  const byPath = (path: string) => listed.data.find((n) => n.path === path) ?? null;

  const open = (path: string) => {
    setEditing(false);
    setSelected(path);
  };

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <NoteList
        notes={notes}
        info={info}
        selected={selected}
        query={query}
        onQuery={setQuery}
        onSelect={open}
        onCreate={() => void create()}
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
            onChange={(md) => {
              setDraft(md);
              autosave.current?.change(md);
            }}
            onReload={() => void load(note.path)}
            onKeepMine={() => void autosave.current?.keepMine()}
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
      {renaming && (
        <RenameNoteDialog
          note={renaming}
          onRenamed={(path) => {
            setRenaming(null);
            setSelected(path);
          }}
          onClose={() => setRenaming(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRemoving(null)}
          title={fr.removeTitle(removing.title)}
          description={fr.removeHelp(removing.path.slice(removing.path.lastIndexOf("/") + 1))}
          confirmLabel={fr.removeConfirm}
          cancelLabel={fr.cancel}
          onConfirm={() => remove(removing)}
          describeError={() => fr.removeFailed}
        />
      )}
    </div>
  );
}
