import type { Database } from "bun:sqlite";
import { parseNote } from "@kibo/core/notes";
import type { NoteMeta } from "@kibo/schema";

export type IndexedNote = { path: string; markdown: string; mtime: number; size: number };
export type NotesIndex = {
  replace(projectId: string, projectKey: string, notes: IndexedNote[]): void;
  list(projectId: string): NoteMeta[];
  get(projectId: string, path: string): NoteMeta | null;
  search(projectId: string, query: string): NoteMeta[];
};

type NoteRow = { path: string; title: string; mtime: number; size: number };
type RelationRow = { path: string; target: string };
type ByProject = { projectId: string };

const NOTE_TABLES = ["notes", "note_links", "note_tickets"] as const;

export function ensureNotesTables(db: Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS notes (project_id TEXT NOT NULL, path TEXT NOT NULL, title TEXT NOT NULL, " +
      "mtime INTEGER NOT NULL, size INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY (project_id, path))",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS note_links (project_id TEXT NOT NULL, from_path TEXT NOT NULL, to_path TEXT NOT NULL, ord INTEGER NOT NULL)",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS note_tickets (project_id TEXT NOT NULL, path TEXT NOT NULL, key TEXT NOT NULL, ord INTEGER NOT NULL)",
  );
}

function grouped(rows: RelationRow[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.path, [...(out.get(r.path) ?? []), r.target]);
  return out;
}

export function createNotesIndex(db: Database): NotesIndex {
  const insertNote = db.query<never, ByProject & NoteRow & { body: string }>(
    "INSERT INTO notes (project_id, path, title, mtime, size, body) VALUES ($projectId, $path, $title, $mtime, $size, $body)",
  );
  const insertLink = db.query<never, ByProject & { from: string; to: string; ord: number }>(
    "INSERT INTO note_links (project_id, from_path, to_path, ord) VALUES ($projectId, $from, $to, $ord)",
  );
  const insertTicket = db.query<never, ByProject & { path: string; key: string; ord: number }>(
    "INSERT INTO note_tickets (project_id, path, key, ord) VALUES ($projectId, $path, $key, $ord)",
  );
  const deletes = NOTE_TABLES.map((table) =>
    db.query<never, ByProject>(`DELETE FROM ${table} WHERE project_id = $projectId`),
  );
  const selectNotes = db.query<NoteRow, ByProject>(
    "SELECT path, title, mtime, size FROM notes WHERE project_id = $projectId ORDER BY mtime DESC, path",
  );
  const searchNotes = db.query<NoteRow, ByProject & { q: string }>(
    "SELECT path, title, mtime, size FROM notes WHERE project_id = $projectId " +
      "AND instr(lower(title || ' ' || body), lower($q)) > 0 ORDER BY mtime DESC, path",
  );
  const selectLinks = db.query<RelationRow, ByProject>(
    "SELECT from_path AS path, to_path AS target FROM note_links WHERE project_id = $projectId ORDER BY from_path, ord",
  );
  const selectTickets = db.query<RelationRow, ByProject>(
    "SELECT path, key AS target FROM note_tickets WHERE project_id = $projectId ORDER BY path, ord",
  );

  const replace = db.transaction((projectId: string, projectKey: string, notes: IndexedNote[]) => {
    for (const d of deletes) d.run({ projectId });
    const paths = notes.map((n) => n.path);
    for (const n of notes) {
      const parsed = parseNote(n.path, n.markdown, projectKey, paths);
      insertNote.run({
        projectId,
        path: n.path,
        title: parsed.title,
        mtime: n.mtime,
        size: n.size,
        body: n.markdown,
      });
      for (const [ord, to] of parsed.links.entries()) insertLink.run({ projectId, from: n.path, to, ord });
      for (const [ord, key] of parsed.tickets.entries())
        insertTicket.run({ projectId, path: n.path, key, ord });
    }
  });

  const withRelations = (projectId: string, rows: NoteRow[]): NoteMeta[] => {
    const links = grouped(selectLinks.all({ projectId }));
    const tickets = grouped(selectTickets.all({ projectId }));
    return rows.map((r) => ({ ...r, tickets: tickets.get(r.path) ?? [], links: links.get(r.path) ?? [] }));
  };

  return {
    replace: (projectId, projectKey, notes) => {
      replace(projectId, projectKey, notes);
    },
    list: (projectId) => withRelations(projectId, selectNotes.all({ projectId })),
    get: (projectId, path) =>
      withRelations(projectId, selectNotes.all({ projectId })).find((n) => n.path === path) ?? null,
    search: (projectId, query) => withRelations(projectId, searchNotes.all({ projectId, q: query })),
  };
}
