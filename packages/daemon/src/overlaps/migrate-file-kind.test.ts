import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "@kibo/core";
import { resolveFileOverlaps } from "./migrate-file-kind";
import { type OverlapStore, openOverlapStore } from "./store";

const homes: string[] = [];
const stores: OverlapStore[] = [];

afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
});

function open(): OverlapStore {
  const home = mkdtempSync(join(tmpdir(), "kibo-migrate-"));
  homes.push(home);
  const store = openOverlapStore(home);
  stores.push(store);
  return store;
}

const base = {
  ownerRunId: "r12",
  otherRunId: "r15",
  ownerWorkspace: "/wt/bou-12",
  otherWorkspace: "/wt/bou-15",
};

const fileFinding = (path: string): Finding => ({
  ...base,
  kind: "file",
  key: `file:${path}`,
  detail: { kind: "file", path },
});

const exportFinding: Finding = {
  ...base,
  kind: "export",
  key: "export:formatDate",
  detail: { kind: "export", name: "formatDate", ownerPath: "src/a.ts", otherPath: "src/b.ts" },
};

test("open file overlaps are resolved once, the others are left alone", () => {
  const store = open();
  const files = ["src/a.ts", "src/b.ts", "src/i18n/fr.ts"].map((p, i) =>
    store.create(fileFinding(p), "p1", i),
  );
  const kept = store.create(exportFinding, "p1", 5);
  expect(resolveFileOverlaps(store, 100)).toBe(3);
  for (const f of files) {
    expect(store.get(f.id)).toMatchObject({ status: "resolved", resolvedAt: 100 });
  }
  expect(store.get(kept.id)).toEqual(kept);
  expect(resolveFileOverlaps(store, 200)).toBe(0);
  for (const f of files) expect(store.get(f.id)?.resolvedAt).toBe(100);
});

test("a file overlap already ignored stays ignored", () => {
  const store = open();
  const ignored = store.create(fileFinding("src/a.ts"), "p1", 1);
  store.event(ignored.id, { type: "ignored", role: null, by: { kind: "human", ref: "adam" }, at: 2 });
  expect(resolveFileOverlaps(store, 100)).toBe(0);
  expect(store.get(ignored.id)?.status).toBe("ignored");
});
