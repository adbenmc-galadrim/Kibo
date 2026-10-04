import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import type { ComponentDraft } from "@kibo/schema";
import { openDraftStore } from "./draft-store";

const draft = (id: string, status: ComponentDraft["status"], updatedAt: number): ComponentDraft => ({
  id,
  componentId: "burndown",
  mode: "create",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  baseVersion: null,
  description: "Burndown du sprint : tickets restants par jour.",
  runId: "r1",
  sessionId: null,
  status,
  attempts: 1,
  failure: status === "failed" ? { kind: "validation", detail: null } : null,
  incidents: [{ kind: "removed", path: "evil.ts" }],
  attachments: [],
  revisions: 0,
  template: "blank",
  projectId: null,
  createdAt: 1,
  updatedAt,
});
const a = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
const b = "1c6d2f4e-8b62-4e3b-8d2f-3a1e7a2c9b22";

test("stores, updates and lists drafts, most recent first", () => {
  const store = openDraftStore(new Database(":memory:", { strict: true }));
  store.insert(draft(a, "generating", 2));
  store.insert(draft(b, "done", 3));
  store.save(draft(a, "failed", 4));
  expect(store.get(a)).toEqual(draft(a, "failed", 4));
  expect(store.list().map((d) => d.id)).toEqual([a, b]);
  expect(store.active().map((d) => d.id)).toEqual([a]);
});

test("keeps the validation report apart", () => {
  const store = openDraftStore(new Database(":memory:", { strict: true }));
  store.insert(draft(a, "failed", 2));
  expect(store.report(a)).toBeNull();
  const report = {
    ok: false,
    manifest: { ok: true, errors: [] },
    imports: { ok: true, errors: [] },
    typecheck: { ok: false, errors: ["error"] },
    tests: { ok: true, passed: 1, failed: 0, output: "" },
    conformance: { ok: true, errors: [] },
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: null,
  };
  store.saveReport(a, report);
  expect(store.report(a)).toEqual(report);
});

test("unknown draft is NOT_FOUND, a corrupt row is STORE_CORRUPT", () => {
  const db = new Database(":memory:", { strict: true });
  const store = openDraftStore(db);
  expect(() => store.get(a)).toThrow("NOT_FOUND");
  store.insert(draft(a, "failed", 2));
  db.run("UPDATE component_drafts SET status = 'bogus' WHERE id = ?", [a]);
  expect(() => store.get(a)).toThrow("STORE_CORRUPT");
});

test("unreadable JSON is STORE_CORRUPT", () => {
  const db = new Database(":memory:", { strict: true });
  const store = openDraftStore(db);
  store.insert(draft(a, "failed", 2));
  db.run("UPDATE component_drafts SET reportJson = '{' WHERE id = ?", [a]);
  expect(() => store.report(a)).toThrow("STORE_CORRUPT");
  db.run("UPDATE component_drafts SET incidentsJson = 'nope' WHERE id = ?", [a]);
  expect(() => store.get(a)).toThrow("STORE_CORRUPT");
  expect(() => store.saveReport(b, null)).toThrow("NOT_FOUND");
});

test("a component has one active draft at most, whatever the writer (I43)", () => {
  const store = openDraftStore(new Database(":memory:", { strict: true }));
  const c = "2d7e3a5f-9c73-4f4c-9e3a-4b2f8b3d0c33";
  store.insert(draft(a, "failed", 2));
  expect(() => store.insert({ ...draft(b, "describing", 3), mode: "modify", baseVersion: "0.1.0" })).toThrow(
    expect.objectContaining({ code: "CONFLICT" }),
  );
  store.insert(draft(b, "done", 3));
  store.save(draft(a, "abandoned", 4));
  store.insert(draft(c, "describing", 5));
  expect(store.active().map((d) => d.id)).toEqual([c]);
});

test("saves the images and the revisions of a draft", () => {
  const store = openDraftStore(new Database(":memory:", { strict: true }));
  store.insert(draft(a, "review", 2));
  const images = [{ name: "a.png", mime: "image/png" as const, bytes: 12 }];
  store.save({ ...draft(a, "generating", 3), attachments: images, revisions: 1 });
  expect(store.get(a)).toMatchObject({ attachments: images, revisions: 1, status: "generating" });
});

test("unreadable images are STORE_CORRUPT", () => {
  const db = new Database(":memory:", { strict: true });
  const store = openDraftStore(db);
  store.insert(draft(a, "review", 2));
  db.run("UPDATE component_drafts SET attachmentsJson = 'nope' WHERE id = ?", [a]);
  expect(() => store.get(a)).toThrow("STORE_CORRUPT");
});

test("a database from before the images is migrated when opened", () => {
  const db = new Database(":memory:", { strict: true });
  db.run(`CREATE TABLE component_drafts (
    id TEXT PRIMARY KEY, componentId TEXT NOT NULL, mode TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL,
    withServer INTEGER NOT NULL, baseVersion TEXT, description TEXT NOT NULL, runId TEXT, sessionId TEXT,
    status TEXT NOT NULL, attempts INTEGER NOT NULL, failureJson TEXT, incidentsJson TEXT NOT NULL,
    reportJson TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)`);
  db.run(
    `INSERT INTO component_drafts (id, componentId, mode, title, kind, withServer, description, status, attempts, incidentsJson, createdAt, updatedAt)
     VALUES (?, 'burndown', 'create', 'Burndown', 'widget', 0, 'Burndown du sprint', 'review', 1, '[]', 1, 1)`,
    [a],
  );
  const store = openDraftStore(db);
  expect(store.get(a)).toMatchObject({ attachments: [], revisions: 0, status: "review" });
  store.save({ ...store.get(a), revisions: 2 });
  expect(store.get(a).revisions).toBe(2);
  expect(openDraftStore(db).get(a).revisions).toBe(2);
});

test("keeps the last feedback of a revision apart, and migrates an older table", () => {
  const db = new Database(":memory:", { strict: true });
  const store = openDraftStore(db);
  store.insert(draft(a, "review", 2));
  expect(store.feedback(a)).toBeNull();
  store.saveFeedback(a, "Mets le total en gros");
  expect(store.feedback(a)).toBe("Mets le total en gros");
  store.save(draft(a, "generating", 3));
  expect(store.feedback(a)).toBe("Mets le total en gros");
  store.saveFeedback(a, null);
  expect(store.feedback(a)).toBeNull();
  expect(() => store.feedback(b)).toThrow("NOT_FOUND");
  expect(() => store.saveFeedback(b, "x")).toThrow("NOT_FOUND");
  db.run("ALTER TABLE component_drafts DROP COLUMN feedback");
  expect(openDraftStore(db).feedback(a)).toBeNull();
});

test("keeps the template of a draft, and an older table reads it as blank", () => {
  const db = new Database(":memory:", { strict: true });
  const store = openDraftStore(db);
  store.insert({ ...draft(a, "review", 2), template: "3d" });
  expect(store.get(a).template).toBe("3d");
  store.save({ ...draft(a, "generating", 3), template: "3d" });
  expect(store.get(a).template).toBe("3d");
  db.run("ALTER TABLE component_drafts DROP COLUMN template");
  expect(openDraftStore(db).get(a).template).toBe("blank");
});

test("keeps the project of a draft, and an older table reads it as none", () => {
  const db = new Database(":memory:", { strict: true });
  const store = openDraftStore(db);
  store.insert({ ...draft(a, "review", 2), projectId: "p-demo" });
  expect(store.get(a).projectId).toBe("p-demo");
  db.run("ALTER TABLE component_drafts DROP COLUMN projectId");
  expect(openDraftStore(db).get(a).projectId).toBeNull();
});
