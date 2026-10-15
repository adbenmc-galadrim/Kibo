import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "@kibo/core";
import { type Actor, type AutoLinkRow, KiboError } from "@kibo/schema";
import { type OverlapStore, openOverlapStore } from "./store";

const homes: string[] = [];
const stores: OverlapStore[] = [];

afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
});

function open(): { store: OverlapStore; home: string } {
  const home = mkdtempSync(join(tmpdir(), "kibo-overlaps-"));
  homes.push(home);
  const store = openOverlapStore(home);
  stores.push(store);
  return { store, home };
}

const ADAM: Actor = { kind: "human", ref: "adam" };

const finding = (p: Partial<Finding> = {}): Finding => ({
  kind: "export",
  key: "export:formatDate",
  ownerRunId: "r12",
  otherRunId: "r15",
  ownerWorkspace: "/wt/bou-12",
  otherWorkspace: "/wt/bou-15",
  detail: {
    kind: "export",
    name: "formatDate",
    ownerPath: "src/lib/format.ts",
    otherPath: "src/utils/date.ts",
  },
  ...p,
});

const autoLinkRow = (p: Partial<Omit<AutoLinkRow, "id">> = {}): Omit<AutoLinkRow, "id"> => ({
  projectId: "p1",
  linkId: "l1",
  fromTicketId: "t12",
  toTicketId: "t15",
  fromTicketKey: "BOU-12",
  toTicketKey: "BOU-15",
  ownerRunId: "r12",
  otherRunId: "r15",
  reason: "import",
  detail: { path: "src/lib/format.ts", name: "formatDate" },
  at: 50,
  ...p,
});

function raw(home: string): Database {
  return new Database(join(home, "runs.db"));
}

describe("overlap store", () => {
  test("create gives an open overlap seen once", () => {
    const { store } = open();
    const o = store.create(finding(), "p1", 10);
    expect(o).toMatchObject({ projectId: "p1", kind: "export", key: "export:formatDate", status: "open" });
    expect(o.firstSeenAt).toBe(10);
    expect(o.lastSeenAt).toBe(10);
    expect(o.deliveredAt).toBeNull();
    expect(store.get(o.id)).toEqual(o);
  });

  test("an open pair cannot be created twice", () => {
    const { store } = open();
    store.create(finding(), "p1", 10);
    const err = (() => {
      try {
        store.create(finding(), "p1", 11);
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(KiboError);
    expect((err as KiboError).code).toBe("CONFLICT");
  });

  test("touch moves lastSeenAt only", () => {
    const { store } = open();
    const o = store.create(finding(), "p1", 10);
    store.touch([o.id], 20);
    expect(store.get(o.id)).toMatchObject({ firstSeenAt: 10, lastSeenAt: 20 });
  });

  test("rows are append-only except lastSeenAt", () => {
    const { store, home } = open();
    const o = store.create(finding(), "p1", 10);
    const db = raw(home);
    expect(() => db.run("UPDATE run_overlaps SET key = 'x' WHERE id = ?", [o.id])).toThrow("append-only");
    expect(() => db.run("DELETE FROM run_overlaps WHERE id = ?", [o.id])).toThrow("append-only");
    expect(() => db.run("DELETE FROM run_overlap_events")).not.toThrow();
    store.event(o.id, { type: "resolved", role: null, by: null, at: 12 });
    expect(() => db.run("DELETE FROM run_overlap_events")).toThrow("append-only");
    expect(() => db.run("UPDATE run_overlaps SET open = 1 WHERE id = ?", [o.id])).toThrow("append-only");
    db.close();
  });

  test("events fold into delivery, resolution and ignore", () => {
    const { store } = open();
    const o = store.create(finding(), "p1", 10);
    expect(store.event(o.id, { type: "delivered", role: "other", by: null, at: 11 }).deliveredAt).toBe(11);
    expect(store.event(o.id, { type: "delivered", role: "owner", by: null, at: 12 }).ownerDeliveredAt).toBe(
      12,
    );
    const resolved = store.event(o.id, { type: "resolved", role: null, by: null, at: 13 });
    expect(resolved).toMatchObject({ status: "resolved", resolvedAt: 13 });
    expect(store.event(o.id, { type: "ignored", role: null, by: ADAM, at: 14 }).status).toBe("resolved");
    const again = store.create(finding(), "p1", 20);
    expect(again.id).not.toBe(o.id);
    const ignored = store.event(again.id, { type: "ignored", role: null, by: ADAM, at: 21 });
    expect(ignored).toMatchObject({ status: "ignored", ignoredBy: ADAM, ignoredAt: 21 });
  });

  test("events come back sorted by date", () => {
    const { store } = open();
    const o = store.create(finding(), "p1", 10);
    store.event(o.id, { type: "delivered", role: "other", by: null, at: 30 });
    expect(store.event(o.id, { type: "delivered", role: "owner", by: null, at: 20 }).ownerDeliveredAt).toBe(
      20,
    );
    expect(store.event(o.id, { type: "resolved", role: null, by: null, at: 25 }).resolvedAt).toBe(25);
  });

  test("an event on an unknown overlap is NOT_FOUND", () => {
    const { store } = open();
    expect(() => store.event("nope", { type: "resolved", role: null, by: null, at: 1 })).toThrow(KiboError);
  });

  test("list filters by project, run and state", () => {
    const { store } = open();
    const a = store.create(finding(), "p1", 10);
    const b = store.create(
      finding({ kind: "file", key: "file:src/a.ts", detail: { kind: "file", path: "src/a.ts" } }),
      "p1",
      11,
    );
    const c = store.create(finding({ ownerRunId: "r20", otherRunId: "r21" }), "p2", 12);
    store.event(b.id, { type: "resolved", role: null, by: null, at: 13 });
    expect(store.list({ projectId: "p1" }).map((o) => o.id)).toEqual([a.id, b.id]);
    expect(store.list({ runId: "r12" }).map((o) => o.id)).toEqual([a.id, b.id]);
    expect(store.list({ runId: "r21" }).map((o) => o.id)).toEqual([c.id]);
    expect(store.list({ projectId: "p1", state: "open" }).map((o) => o.id)).toEqual([a.id]);
    expect(store.open("p1").map((o) => o.id)).toEqual([a.id]);
  });

  test("list filters by kind", () => {
    const { store } = open();
    const a = store.create(finding(), "p1", 10);
    const b = store.create(
      finding({ kind: "file", key: "file:src/a.ts", detail: { kind: "file", path: "src/a.ts" } }),
      "p1",
      11,
    );
    expect(store.list({ kind: "file" }).map((o) => o.id)).toEqual([b.id]);
    expect(store.list({ kind: "export", projectId: "p1" }).map((o) => o.id)).toEqual([a.id]);
    expect(store.list({ kind: "block" })).toEqual([]);
  });

  test("pending gives the undelivered open overlaps with the run's role", () => {
    const { store } = open();
    const o = store.create(finding(), "p1", 10);
    expect(store.pending("r15").map((p) => [p.overlap.id, p.role])).toEqual([[o.id, "other"]]);
    expect(store.pending("r12").map((p) => p.role)).toEqual(["owner"]);
    store.event(o.id, { type: "delivered", role: "other", by: null, at: 11 });
    expect(store.pending("r15")).toEqual([]);
    expect(store.pending("r12")).toHaveLength(1);
    store.event(o.id, { type: "resolved", role: null, by: null, at: 12 });
    expect(store.pending("r12")).toEqual([]);
  });

  test("ignored keys are stored per project and can be reactivated", () => {
    const { store } = open();
    store.ignore("p1", "export", "export:formatDate", "`formatDate`", ADAM, 10);
    store.ignore("p1", "export", "export:formatDate", "`formatDate`", ADAM, 11);
    expect(store.ignoredKeys("p1")).toEqual(new Set(["export:formatDate"]));
    expect(store.ignored("p1")).toEqual([
      { projectId: "p1", kind: "export", key: "export:formatDate", label: "`formatDate`", by: ADAM, at: 10 },
    ]);
    expect(store.ignoredKeys("p2").size).toBe(0);
    store.reactivate("p1", "export", "export:formatDate");
    expect(store.ignored("p1")).toEqual([]);
    expect(store.ignoredKeys("p1").size).toBe(0);
  });

  test("openCountByRun counts both owner and other", () => {
    const { store } = open();
    store.create(finding(), "p1", 10);
    const b = store.create(
      finding({ kind: "file", key: "file:src/a.ts", detail: { kind: "file", path: "src/a.ts" } }),
      "p1",
      11,
    );
    store.create(
      finding({ key: "export:parseDate", otherRunId: "r16", otherWorkspace: "/wt/bou-16" }),
      "p1",
      12,
    );
    expect(store.openCountByRun()).toEqual([
      { runId: "r12", open: 3 },
      { runId: "r15", open: 2 },
      { runId: "r16", open: 1 },
    ]);
    store.event(b.id, { type: "resolved", role: null, by: null, at: 13 });
    expect(store.openCountByRun()[0]).toEqual({ runId: "r12", open: 2 });
  });

  test("auto links are append-only and fold their events", () => {
    const { store, home } = open();
    const link = store.autoLink.create(autoLinkRow());
    expect(link).toMatchObject({ status: "added", linkId: "l1", cancelledBy: null });
    expect(store.autoLink.get(link.id)).toEqual(link);
    expect(store.autoLink.cancelled("p1", "t12", "t15")).toBe(false);
    const cancelled = store.autoLink.event(link.id, { type: "cancelled", by: ADAM, at: 60 });
    expect(cancelled).toMatchObject({ status: "cancelled", cancelledBy: ADAM, cancelledAt: 60 });
    expect(store.autoLink.event(link.id, { type: "removed", by: null, at: 70 }).status).toBe("cancelled");
    expect(store.autoLink.cancelled("p1", "t12", "t15")).toBe(true);
    expect(store.autoLink.cancelled("p1", "t15", "t12")).toBe(false);
    const other = store.autoLink.create(autoLinkRow({ linkId: "l2", projectId: "p2" }));
    expect(store.autoLink.list("p1").map((l) => l.id)).toEqual([link.id]);
    expect(store.autoLink.list("p2").map((l) => l.id)).toEqual([other.id]);
    const db = raw(home);
    expect(() => db.run("UPDATE run_auto_links SET link_id = 'x'")).toThrow("append-only");
    expect(() => db.run("DELETE FROM run_auto_link_events")).toThrow("append-only");
    db.close();
  });

  test("an event on an unknown auto link is NOT_FOUND", () => {
    const { store } = open();
    expect(() => store.autoLink.event("nope", { type: "removed", by: null, at: 1 })).toThrow(KiboError);
    expect(store.autoLink.get("nope")).toBeNull();
  });

  test("the tables live in runs.db, in WAL mode, readable by the owner only", () => {
    const { store, home } = open();
    store.create(finding(), "p1", 10);
    const db = raw(home);
    const files = db.query("PRAGMA database_list").all() as { file: string }[];
    expect(files[0]?.file.endsWith("runs.db")).toBe(true);
    expect((db.query("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toBe("wal");
    db.close();
    expect(statSync(join(home, "runs.db")).mode & 0o777).toBe(0o600);
  });
});
