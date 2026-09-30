import { KiboError, type NoteContent, type NoteMeta } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Autosave, createAutosave, type SaveState } from "./autosave";
import { fr } from "./fr";
import { autoRenameTarget } from "./note-name";

type Session = { path: string; autosave: Autosave; moving: boolean };
type Options = {
  selected: string | null;
  select(path: string): void;
  listed: readonly NoteMeta[];
  fail(message: string): (e: unknown) => void;
};

const close = (s: Session) => void s.autosave.flush().finally(() => s.autosave.dispose());

export function useNoteSession({ selected, select, listed, fail }: Options) {
  const sdk = useSdk();
  const notesApi = useRef(sdk.notes);
  notesApi.current = sdk.notes;
  const listedPaths = useRef<string[]>([]);
  listedPaths.current = listed.map((n) => n.path);
  const session = useRef<Session | null>(null);
  const [note, setNote] = useState<NoteContent | null>(null);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<SaveState>("saved");

  const load = useCallback(
    async (path: string) => {
      try {
        const content = await notesApi.current.read(path);
        if (session.current?.path !== path) return;
        setNote(content);
        setDraft(content.markdown);
        setState("saved");
        session.current.autosave.setBase(content.mtime);
      } catch (e) {
        fail(fr.loadFailed)(e);
      }
    },
    [fail],
  );

  const rename = useCallback(
    async (from: string, to: string): Promise<NoteMeta> => {
      const s = session.current?.path === from ? session.current : null;
      if (s) s.moving = true;
      try {
        if (s && !(await s.autosave.flush())) throw new KiboError("FILE_CHANGED", `${from} not saved`);
        const meta = await notesApi.current.rename(from, to);
        if (s && session.current === s) {
          s.path = meta.path;
          s.autosave.rebase(meta.mtime);
          setNote((n) => (n && n.path === from ? { ...n, ...meta } : n));
          select(meta.path);
          await s.autosave.flush();
        }
        return meta;
      } finally {
        if (s) s.moving = false;
      }
    },
    [select],
  );

  useEffect(() => {
    if (session.current?.path === selected) return;
    if (session.current) close(session.current);
    session.current = null;
    if (selected === null) return;
    const s: Session = {
      path: selected,
      moving: false,
      autosave: createAutosave({
        delayMs: 800,
        save: (md, mtime) => notesApi.current.write(s.path, md, mtime),
        onState: setState,
        onSaved: (meta) => {
          setNote((n) => (n && n.path === meta.path ? { ...n, ...meta } : n));
          const target = s.moving ? null : autoRenameTarget(meta, listedPaths.current);
          if (target === null) return;
          void Promise.resolve()
            .then(() => rename(meta.path, target))
            .catch(fail(fr.renameFailed));
        },
      }),
    };
    session.current = s;
    void load(selected);
  }, [selected, load, rename, fail]);

  useEffect(
    () => () => {
      if (session.current) close(session.current);
      session.current = null;
    },
    [],
  );

  const remove = async (path: string): Promise<boolean> => {
    const s = session.current?.path === path ? session.current : null;
    if (s) await s.autosave.flush();
    await notesApi.current.remove(path);
    if (!s || session.current !== s) return false;
    session.current = null;
    s.autosave.dispose();
    setNote(null);
    return true;
  };

  const change = (md: string) => {
    setDraft(md);
    session.current?.autosave.change(md);
  };

  const keepMine = () => void session.current?.autosave.keepMine();

  return { note, draft, state, load, rename, remove, change, keepMine };
}
