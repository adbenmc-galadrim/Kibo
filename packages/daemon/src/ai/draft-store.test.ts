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
