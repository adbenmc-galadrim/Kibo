import { parseNote } from "@kibo/core/notes";
import {
  type AssetMime,
  AssetName,
  AssetPath,
  KiboError,
  MAX_ASSET_BYTES,
  type NoteContent,
  type NoteMeta,
  type NotesInfo,
  sniffImage,
} from "@kibo/schema";
import type { NoteAsset } from "./types";

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
  attach(name: string, mime: AssetMime, bytes: Uint8Array): string;
  asset(path: string): NoteAsset;
  touch(path: string, markdown: string): void;
};

const DAY = 86_400_000;
const MOCK_NOTES_INFO: NotesInfo = {
  dir: "/Users/adam/goinfre/Kibo/notes",
  displayDir: "~/goinfre/Kibo/notes",
  obsidian: true,
  folderRelative: "notes",
};

const suffixed = (name: string, n: number): string =>
  n === 1 ? name : name.replace(/(\.[a-z]+)$/, `-${n}$1`);

function createMockAssets() {
  const assets = new Map<string, NoteAsset>();
  return {
    attach(name: string, mime: AssetMime, bytes: Uint8Array): string {
      if (!AssetName.safeParse(name).success)
        throw new KiboError("INVALID_INPUT", `invalid asset name ${name}`);
      if (bytes.byteLength > MAX_ASSET_BYTES) throw new KiboError("TOO_LARGE", `${name} is too large`);
      if (sniffImage(bytes) !== mime) throw new KiboError("INVALID_INPUT", `${name} is not a ${mime}`);
      let n = 1;
      while (assets.has(`assets/${suffixed(name, n)}`)) n += 1;
      const path = `assets/${suffixed(name, n)}`;
      assets.set(path, { mime, bytes: bytes.slice() });
      return path;
    },
    asset(path: string): NoteAsset {
      if (!AssetPath.safeParse(path).success)
        throw new KiboError("INVALID_INPUT", `invalid asset path ${path}`);
      const asset = assets.get(path);
      if (!asset) throw new KiboError("NOT_FOUND", `${path} not found`);
      return { mime: asset.mime, bytes: asset.bytes.slice() };
    },
  };
}

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

  const assets = createMockAssets();

  return {
    notes,
    list,
    attach: assets.attach,
    asset: assets.asset,
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
