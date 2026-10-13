import { expect, test } from "bun:test";
import {
  type AutoLinkRow,
  foldAutoLink,
  foldOverlap,
  OverlapDetail,
  type OverlapRow,
  overlapKey,
} from "./overlap";
import { isOverlapRequest, OVERLAP_RPC } from "./overlap-rpc";
import {
  DEFAULT_DUPLICATION_SETTINGS,
  DUPLICATION_GENERIC_EXPORTS,
  DUPLICATION_LIMITS,
  DUPLICATION_SECRET_GLOBS,
  DUPLICATION_TEST_GLOBS,
  DuplicationSettings,
} from "./overlap-settings";
import { PeekWorkInput } from "./progress";
import { RpcRequest } from "./rpc";

const ADAM = { kind: "human", ref: "adam" } as const;

const row: OverlapRow = {
  id: "o1",
  projectId: "p1",
  kind: "export",
  key: "export:formatDate",
  ownerRunId: "r1",
  otherRunId: "r2",
  ownerWorkspace: "/w/a",
  otherWorkspace: "/w/b",
  detail: {
    kind: "export",
    name: "formatDate",
    ownerPath: "src/lib/format.ts",
    otherPath: "src/utils/date.ts",
  },
  firstSeenAt: 1,
};

const linkRow: AutoLinkRow = {
  id: "l1",
  projectId: "p1",
  linkId: "k1",
  fromTicketId: "t12",
  toTicketId: "t15",
  fromTicketKey: "BOU-12",
  toTicketKey: "BOU-15",
  ownerRunId: "r1",
  otherRunId: "r2",
  reason: "copy",
  detail: { path: "src/lib/format-date.ts", name: null },
  at: 3,
};

test("an overlap detail is checked by kind", () => {
  const block = {
    kind: "block" as const,
    ownerPath: "a",
    ownerStart: 1,
    otherPath: "b",
    otherStart: 3,
    lines: 8,
    chars: 200,
  };
  expect(OverlapDetail.parse(block)).toEqual(block);
  expect(OverlapDetail.safeParse({ ...block, ownerStart: 0 }).success).toBe(false);
  expect(OverlapDetail.safeParse({ kind: "file", path: "src/i18n/fr.ts" }).success).toBe(true);
});

test("an overlap key joins its kind and its key", () => {
  expect(overlapKey("export", "formatDate")).toBe("export:formatDate");
  expect(overlapKey("file", "src/a.ts")).toBe("file:src/a.ts");
});

test("an overlap without events is open and undelivered", () => {
  expect(foldOverlap(row, 10, [])).toEqual({
    ...row,
    lastSeenAt: 10,
    status: "open",
    deliveredAt: null,
    ownerDeliveredAt: null,
    resolvedAt: null,
    ignoredBy: null,
    ignoredAt: null,
  });
});

test("deliveries are kept by role and the first final event wins", () => {
  const resolved = foldOverlap(row, 10, [
    { type: "delivered", role: "other", by: null, at: 5 },
    { type: "delivered", role: "owner", by: null, at: 6 },
    { type: "delivered", role: "other", by: null, at: 7 },
    { type: "resolved", role: null, by: null, at: 9 },
  ]);
  expect(resolved).toMatchObject({ deliveredAt: 5, ownerDeliveredAt: 6, status: "resolved", resolvedAt: 9 });
  const ignored = foldOverlap(row, 10, [
    { type: "ignored", role: null, by: ADAM, at: 4 },
    { type: "resolved", role: null, by: null, at: 8 },
  ]);
  expect(ignored).toMatchObject({ status: "ignored", ignoredBy: ADAM, ignoredAt: 4, resolvedAt: null });
});

test("an automatic link is added until it is cancelled or removed", () => {
  expect(foldAutoLink(linkRow, [])).toEqual({
    ...linkRow,
    status: "added",
    cancelledBy: null,
    cancelledAt: null,
  });
  expect(foldAutoLink(linkRow, [{ type: "cancelled", by: ADAM, at: 5 }])).toMatchObject({
    status: "cancelled",
    cancelledBy: ADAM,
    cancelledAt: 5,
  });
  expect(
    foldAutoLink(linkRow, [
      { type: "removed", by: null, at: 5 },
      { type: "cancelled", by: ADAM, at: 6 },
    ]),
  ).toMatchObject({ status: "removed", cancelledBy: null, cancelledAt: null });
});

test("duplication settings are bounded and strict", () => {
  const settings = { enabled: true, minLines: 8, compareTests: false, ignore: [], genericExports: [] };
  expect(DuplicationSettings.parse(settings)).toEqual(settings);
  expect(DuplicationSettings.safeParse({ ...settings, minLines: 3 }).success).toBe(false);
  expect(DuplicationSettings.safeParse({ ...settings, minLines: 51 }).success).toBe(false);
  const globs = Array.from({ length: 51 }, (_, i) => `src/g${i}/**`);
  expect(DuplicationSettings.safeParse({ ...settings, ignore: globs }).success).toBe(false);
  expect(DuplicationSettings.safeParse({ ...settings, extra: 1 }).success).toBe(false);
  expect(DuplicationSettings.safeParse({}).success).toBe(false);
});

test("the default settings carry the generic exports of the frameworks", () => {
  expect(DuplicationSettings.parse(DEFAULT_DUPLICATION_SETTINGS)).toEqual(DEFAULT_DUPLICATION_SETTINGS);
  expect(DEFAULT_DUPLICATION_SETTINGS).toMatchObject({
    enabled: true,
    minLines: 8,
    compareTests: false,
    ignore: [],
  });
  for (const name of ["default", "Props", "GET", "index"]) {
    expect(DEFAULT_DUPLICATION_SETTINGS.genericExports).toContain(name);
  }
  expect(DEFAULT_DUPLICATION_SETTINGS.genericExports).toEqual([...DUPLICATION_GENERIC_EXPORTS]);
});

test("limits and ignored paths follow the spec", () => {
  expect(DUPLICATION_LIMITS.sweepMs).toBe(300_000);
  expect(DUPLICATION_LIMITS.windowLines).toBe(6);
  for (const glob of [".env", ".env.*", "*.pem", "id_rsa*"]) expect(DUPLICATION_SECRET_GLOBS).toContain(glob);
  for (const glob of ["*.test.*", "__tests__/", "fixtures/"]) expect(DUPLICATION_TEST_GLOBS).toContain(glob);
});

test("peek_work takes a run and an optional path", () => {
  expect(PeekWorkInput.parse({ run: "BOU-12" })).toEqual({ run: "BOU-12" });
  expect(PeekWorkInput.parse({ run: "BOU-12", path: "src/a.ts" })).toEqual({
    run: "BOU-12",
    path: "src/a.ts",
  });
  expect(PeekWorkInput.safeParse({}).success).toBe(false);
  expect(PeekWorkInput.safeParse({ run: "" }).success).toBe(false);
});

test("overlap requests are recognised by their method", () => {
  expect(isOverlapRequest({ method: "overlaps.list" })).toBe(true);
  expect(isOverlapRequest({ method: "autoLinks.cancel" })).toBe(true);
  expect(isOverlapRequest({ method: "listSignals" })).toBe(false);
  const methods = OVERLAP_RPC.map((schema) => schema.shape.method.value);
  expect(methods).toEqual([
    "overlaps.list",
    "overlaps.ignore",
    "overlaps.reactivate",
    "overlaps.ignored",
    "overlaps.read",
    "overlaps.parallel",
    "autoLinks.list",
    "autoLinks.cancel",
  ]);
  expect(RpcRequest.safeParse({ method: "overlaps.list", runId: "r1", state: "open" }).success).toBe(true);
  expect(
    RpcRequest.safeParse({ method: "overlaps.reactivate", projectId: "p", kind: "x", key: "k" }).success,
  ).toBe(false);
});
