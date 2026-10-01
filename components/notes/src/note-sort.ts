import type { NoteMeta } from "@kibo/schema";

export type NoteSort = "recent" | "title";
export type NoteGroup = { dir: string; notes: NoteMeta[] };

export const NOTE_SORT_KEY = "kibo.notes.sort";
export const NOTE_SORTS: readonly NoteSort[] = ["recent", "title"];

const byText = (a: string, b: string) => a.localeCompare(b, "fr");

const COMPARE: Record<NoteSort, (a: NoteMeta, b: NoteMeta) => number> = {
  recent: (a, b) => b.mtime - a.mtime,
  title: (a, b) => byText(a.title, b.title),
};

const dirOf = (path: string): string => {
  const slash = path.indexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
};

export function groupNotes(notes: readonly NoteMeta[], sort: NoteSort): NoteGroup[] {
  const groups = new Map<string, NoteMeta[]>();
  for (const n of notes) groups.set(dirOf(n.path), [...(groups.get(dirOf(n.path)) ?? []), n]);
  const compare = COMPARE[sort];
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : byText(a, b)))
    .map(([dir, list]) => ({ dir, notes: list.sort((a, b) => compare(a, b) || byText(a.path, b.path)) }));
}

function withStorage<T>(work: (storage: Storage) => T, fallback: T): T {
  try {
    return work(window.localStorage);
  } catch (e) {
    console.error(`local preference ${NOTE_SORT_KEY} unavailable`, e);
    return fallback;
  }
}

export function readNoteSort(): NoteSort {
  const stored = withStorage((s) => s.getItem(NOTE_SORT_KEY), null);
  return NOTE_SORTS.find((s) => s === stored) ?? "recent";
}

export function writeNoteSort(sort: NoteSort): void {
  withStorage((s) => s.setItem(NOTE_SORT_KEY, sort), undefined);
}
