import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { join } from "node:path";
import type { SkillReviewRow } from "@kibo/schema";
import { cleanSkillDirs, tempDir } from "./fakes.test-helper";
import { openSkillReviewStore } from "./reviews-store";

cleanSkillDirs();

const row = (p: Partial<SkillReviewRow> = {}): Omit<SkillReviewRow, "id"> => ({
  runId: "r1",
  runLabel: "kib · livraison · KIB-14",
  agentName: "livraison",
  projectId: "p1",
  ticketId: "t1",
  ticketKey: "KIB-14",
  skillId: "a",
  skillPath: "/skills/a",
  baseHash: null,
  verdict: "improve",
  note: "Clair.",
  suggestion: "# A v2",
  createdAt: 10,
  ...p,
});

const adam = { kind: "human" as const, ref: "adam" };

function rig() {
  const home = tempDir();
  return { home, store: openSkillReviewStore(home) };
}

test("a review is created new and read back by run, by skill and by id", () => {
  const { store } = rig();
  const created = store.create(row());
  expect(created).toMatchObject({
    ...row(),
    status: "new",
    decidedAt: null,
    decidedBy: null,
    versionId: null,
  });
  expect(created.id).toEqual(expect.any(String));
  store.create(row({ runId: "r2", skillId: "b" }));
  expect(store.get(created.id)).toEqual(created);
  expect(store.byRun("r1").map((r) => r.skillId)).toEqual(["a"]);
  expect(store.bySkill("b").map((r) => r.runId)).toEqual(["r2"]);
  expect(store.get("nope")).toBeNull();
});

test("the reviews are append-only", () => {
  const { home, store } = rig();
  const created = store.create(row());
  store.appendEvent(created.id, { type: "ignored", by: adam, at: 11, versionId: null });
  store.close();
  const db = new Database(join(home, "runs.db"), { strict: true });
  expect(() => db.exec(`UPDATE skill_reviews SET note = 'x' WHERE id = '${created.id}'`)).toThrow(
    "append-only",
  );
  expect(() => db.exec("DELETE FROM skill_reviews")).toThrow("append-only");
  expect(() => db.exec("DELETE FROM skill_review_events")).toThrow("append-only");
  db.close();
});

test("the first final event wins and a later one writes no row", () => {
  const { home, store } = rig();
  const created = store.create(row());
  const integrated = store.appendEvent(created.id, { type: "integrated", by: adam, at: 20, versionId: "v1" });
  expect(integrated).toMatchObject({ status: "integrated", decidedAt: 20, decidedBy: adam, versionId: "v1" });
  expect(store.appendEvent(created.id, { type: "ignored", by: adam, at: 30, versionId: null }).status).toBe(
    "integrated",
  );
  const db = new Database(join(home, "runs.db"), { strict: true });
  expect(db.query("SELECT COUNT(*) AS n FROM skill_review_events").get()).toEqual({ n: 1 });
  db.close();
  expect(() => store.appendEvent("nope", { type: "ignored", by: adam, at: 1, versionId: null })).toThrow(
    "not found",
  );
});

test("replaceOpen marks the new reviews of a run and a skill as replaced, and openCount follows", () => {
  const { store } = rig();
  const first = store.create(row());
  const ignored = store.create(row());
  store.appendEvent(ignored.id, { type: "ignored", by: adam, at: 11, versionId: null });
  const other = store.create(row({ runId: "r2" }));
  expect(store.openCount("a")).toBe(2);
  store.replaceOpen("r1", "a", 15);
  expect(store.get(first.id)).toMatchObject({ status: "replaced", decidedAt: 15, decidedBy: null });
  expect(store.get(ignored.id)?.status).toBe("ignored");
  expect(store.get(other.id)?.status).toBe("new");
  expect(store.openCount("a")).toBe(1);
  expect(store.openCount("zzz")).toBe(0);
});
