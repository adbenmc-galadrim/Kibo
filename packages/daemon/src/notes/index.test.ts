import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createNotesIndex, ensureNotesTables } from "./index";
import { createProjectSettings, ensureSettingsTable } from "./settings";

function index() {
  const db = new Database(":memory:", { strict: true });
  ensureNotesTables(db);
  return createNotesIndex(db);
}

const NOTES = [
  {
    path: "decisions-architecture.md",
    markdown: "# Décisions d'architecture\n\nVoir KIB-12 et KIB-13.\n\n```\nKIB-99\n```",
    mtime: 300,
    size: 10,
  },
  {
    path: "journal-agents.md",
    markdown: "# Journal agents\n\n[[decisions-architecture]] puis [[decisions-architecture|encore]]",
    mtime: 200,
    size: 10,
  },
  {
    path: "idees.md",
    markdown: "---\ntickets: [KIB-21]\n---\nPas de titre, voir [archi](decisions-architecture.md)",
    mtime: 100,
    size: 10,
  },
];

test("the index keeps titles, tickets and one link per occurrence, newest first", () => {
  const idx = index();
  idx.replace("p1", "KIB", NOTES);
  expect(idx.list("p1").map((n) => [n.path, n.title, n.tickets, n.links])).toEqual([
    ["decisions-architecture.md", "Décisions d'architecture", ["KIB-12", "KIB-13"], []],
    ["journal-agents.md", "Journal agents", [], ["decisions-architecture.md", "decisions-architecture.md"]],
    ["idees.md", "idees", ["KIB-21"], ["decisions-architecture.md"]],
  ]);
  expect(idx.get("p1", "idees.md")?.mtime).toBe(100);
  expect(idx.get("p1", "absent.md")).toBeNull();
});

test("search matches title and body, case-insensitively, per project", () => {
  const idx = index();
  idx.replace("p1", "KIB", NOTES);
  idx.replace("p2", "API", [{ path: "x.md", markdown: "# Agents", mtime: 1, size: 1 }]);
  expect(idx.search("p1", "AGENTS").map((n) => n.path)).toEqual(["journal-agents.md"]);
  expect(idx.search("p1", "titre").map((n) => n.path)).toEqual(["idees.md"]);
  expect(idx.search("p1", "%").map((n) => n.path)).toEqual([]);
  idx.replace("p1", "KIB", []);
  expect(idx.list("p1")).toEqual([]);
  expect(idx.list("p2")).toHaveLength(1);
});

test("project settings are local key/values", () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const s = createProjectSettings(db);
  expect(s.get("p1", "notesDir")).toBeNull();
  s.set("p1", "notesDir", "/a");
  s.set("p1", "notesDir", "/b");
  expect(s.get("p1", "notesDir")).toBe("/b");
});

test("clear drops the notes, links and ticket mentions of one project", () => {
  const db = new Database(":memory:", { strict: true });
  ensureNotesTables(db);
  const idx = createNotesIndex(db);
  idx.replace("p1", "KIB", NOTES);
  idx.replace("p2", "KIB", NOTES);
  idx.clear("p1");
  expect(idx.list("p1")).toEqual([]);
  expect(idx.search("p1", "agents")).toEqual([]);
  expect(idx.list("p2")).toHaveLength(3);
  const rows = (table: string, projectId: string) =>
    db
      .query<{ n: number }, { projectId: string }>(
        `SELECT count(*) AS n FROM ${table} WHERE project_id = $projectId`,
      )
      .get({ projectId })?.n;
  for (const table of ["notes", "note_links", "note_tickets"]) {
    expect([table, rows(table, "p1")]).toEqual([table, 0]);
    expect(rows(table, "p2")).toBeGreaterThan(0);
  }
});
