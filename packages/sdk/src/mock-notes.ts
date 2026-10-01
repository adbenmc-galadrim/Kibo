import { parseNote } from "@kibo/core/notes";
import { KiboError, type NoteContent, type NoteMeta, type NotesInfo } from "@kibo/schema";

export type MockNote = { markdown: string; mtime: number };

export type MockNotesFolder = {
  notes: Map<string, MockNote>;
  list(): NoteMeta[];
  read(path: string): NoteContent;
  write(path: string, markdown: string, expectedMtime: number | null): NoteMeta;
  create(path: string, markdown: string): NoteMeta;
  rename(from: string, to: string): NoteMeta;
  remove(path: string): void;
  search(query: string): NoteMeta[];
  info(): NotesInfo;
  touch(path: string, markdown: string): void;
};

const DAY = 86_400_000;
const MOCK_NOTES_INFO: NotesInfo = {
  dir: "/Users/adam/goinfre/Kibo/notes",
  displayDir: "~/goinfre/Kibo/notes",
  obsidian: true,
  folderRelative: "notes",
};

const byRecency = (a: NoteMeta, b: NoteMeta) =>
  b.mtime - a.mtime || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function createMockNotes(
  initial: Record<string, string>,
  ages: Record<string, number>,
  projectKey: string,
  onChange: () => void,
): MockNotesFolder {
  const now = Date.now();
  const notes = new Map<string, MockNote>(
    Object.entries(initial).map(([path, markdown]) => [
      path,
      { markdown, mtime: now - (ages[path] ?? 0) * DAY },
    ]),
  );
  let clock = now;
  const tick = () => {
    clock += 1;
    return clock;
  };
  const existing = (path: string): MockNote => {
    const note = notes.get(path);
    if (!note) throw new KiboError("NOT_FOUND", `note ${path} not found`);
    return note;
  };
  const metaOf = (path: string): NoteMeta => {
    const note = existing(path);
    const parsed = parseNote(path, note.markdown, projectKey, [...notes.keys()]);
    return { path, ...parsed, mtime: note.mtime, size: new TextEncoder().encode(note.markdown).byteLength };
  };
  const list = () => [...notes.keys()].map(metaOf).sort(byRecency);
  const changed = <T>(value: T): T => {
    onChange();
    return value;
  };

  return {
    notes,
    list,
    read: (path) => ({ ...metaOf(path), markdown: existing(path).markdown }),
    write: (path, markdown, expectedMtime) => {
      if (expectedMtime !== null && notes.get(path)?.mtime !== expectedMtime) {
        throw new KiboError("CONFLICT", `${path} changed`);
      }
      notes.set(path, { markdown, mtime: tick() });
      return changed(metaOf(path));
    },
    create: (path, markdown) => {
      if (notes.has(path)) throw new KiboError("CONFLICT", `${path} already exists`);
      notes.set(path, { markdown, mtime: tick() });
      return changed(metaOf(path));
    },
    rename: (from, to) => {
      const note = existing(from);
      if (notes.has(to)) throw new KiboError("CONFLICT", `${to} exists`);
      notes.delete(from);
      notes.set(to, { ...note, mtime: tick() });
      return changed(metaOf(to));
    },
    remove: (path) => {
      existing(path);
      notes.delete(path);
      changed(null);
    },
    search: (query) => {
      const q = query.toLowerCase();
      return list().filter((n) =>
        `${n.title}\n${notes.get(n.path)?.markdown ?? ""}`.toLowerCase().includes(q),
      );
    },
    info: () => MOCK_NOTES_INFO,
    touch: (path, markdown) => {
      clock += 1000;
      notes.set(path, { markdown, mtime: tick() });
      onChange();
    },
  };
}
