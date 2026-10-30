import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startNotes } from "./bootstrap";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function setup() {
  const root = mkdtempSync(join(tmpdir(), "kibo-notes-boot-"));
  roots.push(root);
  const folder = join(root, "silo");
  mkdirSync(join(folder, "notes"), { recursive: true });
  writeFileSync(join(folder, "notes", "brief.md"), "# Brief\n");
  const removed: ((projectId: string) => void)[] = [];
  const emitted: (string | null)[] = [];
  const docs = {
    projectIds: () => ["p1"],
    projectMeta: () => ({ id: "p1", key: "SILO", folder }),
    emit: (message: { projectId: string | null }) => emitted.push(message.projectId),
    onProjectRemoved: (listener: (projectId: string) => void) => {
      removed.push(listener);
      return () => removed.splice(removed.indexOf(listener), 1);
    },
  };
  const db = new Database(":memory:", { strict: true });
  return { root, db, docs, removed, emitted };
}

test("the notes service is created without the components service", async () => {
  const s = setup();
  const started = await startNotes({ db: s.db, home: join(s.root, "home"), docs: s.docs });
  expect(started.notesDir("p1")).toBe(join(s.root, "silo", "notes"));
  const notes = await started.notes.handle("p1", { kind: "list", entity: "note" });
  expect(notes).toMatchObject([{ path: "brief.md" }]);
  expect(s.removed).toHaveLength(1);
  started.stop();
  expect(s.removed).toHaveLength(0);
  s.db.close();
});
