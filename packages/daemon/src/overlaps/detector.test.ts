import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_DUPLICATION_SETTINGS,
  type DuplicationSettings,
  type MomentData,
  overlapSummary,
  type WorkspaceIndex,
  type WorkspaceRun,
} from "@kibo/schema";
import { createOverlapDetector, type DetectorSpace } from "./detector";
import { type FakeIndexer, fakeIndexer, indexedFile, indexOf, wsRef } from "./detector-fakes.test-helper";
import { sha256Hex } from "./hash";
import { type OverlapStore, openOverlapStore } from "./store";

const homes: string[] = [];
const stores: OverlapStore[] = [];

afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
});

const WS1 = "/w/ws1";
const WS2 = "/w/ws2";
const run = (key: string, runId: string, startedAt: number): WorkspaceRun => ({ key, runId, startedAt });
const space = (key: string, runs: WorkspaceRun[]): DetectorSpace => ({
  ws: wsRef(key),
  runs,
  allRunIds: runs.map((r) => r.runId),
});
const formatIn = (key: string, path: string): WorkspaceIndex =>
  indexOf(key, [indexedFile(path, ["formatDate"])]);

type Setup = { spaces?: DetectorSpace[]; settings?: DuplicationSettings; indexer?: FakeIndexer };

function setup({
  spaces = [space(WS1, [run(WS1, "r1", 100)]), space(WS2, [run(WS2, "r2", 200), run(WS2, "r3", 250)])],
  settings = DEFAULT_DUPLICATION_SETTINGS,
  indexer = fakeIndexer(),
}: Setup = {}) {
  const home = mkdtempSync(join(tmpdir(), "kibo-detector-"));
  homes.push(home);
  const store = openOverlapStore(home);
  stores.push(store);
  const moments: { runId: string; data: MomentData }[] = [];
  const logs: string[] = [];
  const evaluated: { projectId: string; indexes: string[]; runs: string[] }[] = [];
  const clock = { now: 1_000 };
  const state = { spaces, settings, emits: 0 };
  const detector = createOverlapDetector({
    store,
    indexer,
    workspaces: async () => state.spaces,
    projectOf: (runId) => (state.spaces.some((s) => s.allRunIds.includes(runId)) ? "P" : null),
    settings: () => state.settings,
    runName: (runId) => `bou · livraison · ${runId}`,
    moment: (runId, data) => moments.push({ runId, data }),
    emit: () => {
      state.emits += 1;
    },
    now: () => clock.now,
    log: (line) => logs.push(line),
    hash: sha256Hex,
    autoLinker: {
      evaluate: async (projectId, indexes, runs) => {
        evaluated.push({ projectId, indexes: indexes.map((i) => i.key), runs: runs.map((r) => r.runId) });
      },
    },
  });
  return { detector, store, indexer, moments, logs, evaluated, clock, state };
}

function writeSetup() {
  const indexer = fakeIndexer();
  indexer.preload(formatIn(WS1, "src/lib/format.ts"));
  indexer.single.set(`${WS2}:src/utils/date.ts`, formatIn(WS2, "src/utils/date.ts"));
  return setup({ indexer });
}

test("a write that exports a name already exported elsewhere opens an overlap with the writer as other", async () => {
  const { detector, store, moments, state, indexer } = writeSetup();
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  const [open] = store.open("P");
  expect(store.open("P")).toHaveLength(1);
  expect(open).toMatchObject({
    kind: "export",
    key: "export:formatDate",
    ownerRunId: "r1",
    ownerWorkspace: WS1,
    otherRunId: "r2",
    otherWorkspace: WS2,
  });
  const detail = open?.detail ?? { kind: "file", path: "" };
  expect(moments).toEqual([
    {
      runId: "r1",
      data: {
        kind: "overlap",
        overlapId: open?.id ?? "",
        overlapKind: "export",
        role: "owner",
        withRunId: "r2",
        withRunName: "bou · livraison · r2",
        summary: overlapSummary(detail, "bou · livraison · r2", "owner"),
      },
    },
    ...["r2", "r3"].map((runId) => ({
      runId,
      data: {
        kind: "overlap" as const,
        overlapId: open?.id ?? "",
        overlapKind: "export" as const,
        role: "other" as const,
        withRunId: "r1",
        withRunName: "bou · livraison · r1",
        summary: overlapSummary(detail, "bou · livraison · r1", "other"),
      },
    })),
  ]);
  expect(state.emits).toBe(1);
  expect(indexer.calls).toEqual([`index ${WS2}`, `file ${WS2} src/utils/date.ts`]);
});

test("a write outside the workspace, from a run without workspace or with detection off does nothing", async () => {
  const { detector, store, indexer, state } = writeSetup();
  await detector.onWrite("r2", "/elsewhere/src/utils/date.ts");
  await detector.onWrite("isolated", `${WS2}/src/utils/date.ts`);
  state.settings = { ...DEFAULT_DUPLICATION_SETTINGS, enabled: false };
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  expect(store.open("P")).toEqual([]);
  expect(indexer.calls).toEqual([]);
});

test("the same write again only touches the overlap, and the write that removes the export resolves it", async () => {
  const { detector, store, moments, clock, indexer, state } = writeSetup();
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  clock.now = 2_000;
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  expect(store.open("P")[0]?.lastSeenAt).toBe(2_000);
  expect(moments).toHaveLength(3);
  expect(state.emits).toBe(1);
  indexer.single.set(`${WS2}:src/utils/date.ts`, indexOf(WS2, [indexedFile("src/utils/date.ts")]));
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  expect(store.open("P")).toEqual([]);
  expect(store.list({ projectId: "P" })[0]?.status).toBe("resolved");
  expect(moments).toHaveLength(3);
  expect(state.emits).toBe(2);
});

test("a write never resolves on a partial index", async () => {
  const { detector, store, indexer } = writeSetup();
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  indexer.single.set(`${WS2}:src/utils/date.ts`, indexOf(WS2, [indexedFile("src/utils/date.ts")], true));
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  expect(store.open("P")).toHaveLength(1);
});

test("an ignored key creates nothing", async () => {
  const { detector, store } = writeSetup();
  store.ignore("P", "export", "export:formatDate", "`formatDate`", { kind: "human", ref: "adam" }, 1);
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  expect(store.list({ projectId: "P" })).toEqual([]);
});

test("a sweep with a single workspace does nothing", async () => {
  const { detector, indexer } = setup({ spaces: [space(WS1, [run(WS1, "r1", 100)])] });
  expect(await detector.sweep("P")).toEqual({ compared: 0, partial: false });
  expect(indexer.calls).toEqual([]);
});

const staleFinding = (otherWorkspace = WS2) => ({
  kind: "file" as const,
  key: "file:src/old.ts",
  ownerRunId: "r1",
  otherRunId: "r2",
  ownerWorkspace: WS1,
  otherWorkspace,
  detail: { kind: "file" as const, path: "src/old.ts" },
});

test("a sweep indexes every workspace, opens new overlaps for the oldest and youngest runs and resolves absent ones", async () => {
  const indexer = fakeIndexer();
  indexer.full.set(WS1, formatIn(WS1, "src/lib/format.ts"));
  indexer.full.set(WS2, formatIn(WS2, "src/utils/date.ts"));
  const { detector, store, evaluated } = setup({ indexer });
  const stale = store.create(staleFinding(), "P", 10);
  expect(await detector.sweep("P")).toEqual({ compared: 1, partial: false });
  expect(indexer.calls).toEqual([`index ${WS1}`, `index ${WS2}`]);
  expect(store.get(stale.id)?.status).toBe("resolved");
  expect(store.open("P")).toMatchObject([{ key: "export:formatDate", ownerRunId: "r1", otherRunId: "r3" }]);
  expect(evaluated).toEqual([{ projectId: "P", indexes: [WS1, WS2], runs: ["r1", "r2"] }]);
});

test("a write never feeds the auto linker", async () => {
  const { detector, evaluated } = writeSetup();
  await detector.onWrite("r2", `${WS2}/src/utils/date.ts`);
  expect(evaluated).toEqual([]);
});

test("past 16 workspaces only the oldest are indexed and only compared pairs settle", async () => {
  const spaces = Array.from({ length: 17 }, (_, i) =>
    space(`/w/s${i}`, [run(`/w/s${i}`, `r${i}`, 1_000 - i)]),
  );
  const { detector, indexer, logs, store } = setup({ spaces });
  const compared = store.create(
    { ...staleFinding(), ownerWorkspace: "/w/s1", otherWorkspace: "/w/s2" },
    "P",
    10,
  );
  const skipped = store.create(
    { ...staleFinding(), ownerWorkspace: "/w/s0", otherWorkspace: "/w/s1" },
    "P",
    10,
  );
  expect((await detector.sweep("P")).partial).toBe(true);
  expect(indexer.calls).toHaveLength(16);
  expect(indexer.calls).not.toContain("index /w/s0");
  expect(logs.some((l) => l.includes("détection partielle"))).toBe(true);
  expect(store.get(compared.id)?.status).toBe("resolved");
  expect(store.get(skipped.id)?.status).toBe("open");
});

test("a workspace whose index fails is logged and the other pairs still settle", async () => {
  const WS3 = "/w/ws3";
  const indexer = fakeIndexer();
  indexer.full.set(WS1, formatIn(WS1, "src/lib/format.ts"));
  indexer.full.set(WS2, formatIn(WS2, "src/utils/date.ts"));
  indexer.full.set(WS3, new Error("git timed out"));
  const spaces = [
    space(WS1, [run(WS1, "r1", 100)]),
    space(WS2, [run(WS2, "r2", 200)]),
    space(WS3, [run(WS3, "r4", 300)]),
  ];
  const { detector, store, logs } = setup({ spaces, indexer });
  const cleanPair = store.create(staleFinding(), "P", 10);
  const failedPair = store.create({ ...staleFinding(WS3), otherRunId: "r4" }, "P", 10);
  expect(await detector.sweep("P")).toEqual({ compared: 1, partial: true });
  expect(logs.some((l) => l.includes("git timed out"))).toBe(true);
  expect(store.get(cleanPair.id)?.status).toBe("resolved");
  expect(store.get(failedPair.id)?.status).toBe("open");
  expect(store.open("P").map((o) => o.key)).toContain("export:formatDate");
});

test("a sweep past its budget stops after the current pair", async () => {
  const WS3 = "/w/ws3";
  const indexer = fakeIndexer();
  indexer.full.set(WS1, formatIn(WS1, "src/a.ts"));
  indexer.full.set(WS2, formatIn(WS2, "src/b.ts"));
  indexer.full.set(WS3, formatIn(WS3, "src/c.ts"));
  const spaces = [
    space(WS1, [run(WS1, "r1", 100)]),
    space(WS2, [run(WS2, "r2", 200)]),
    space(WS3, [run(WS3, "r4", 300)]),
  ];
  const { detector, store, logs, clock, evaluated } = setup({ spaces, indexer });
  indexer.onIndex = (key) => {
    if (key === WS3) clock.now += 31_000;
  };
  expect(await detector.sweep("P")).toEqual({ compared: 1, partial: true });
  expect(store.open("P")).toMatchObject([{ ownerWorkspace: WS1, otherWorkspace: WS2 }]);
  expect(logs.some((l) => l.includes("budget"))).toBe(true);
  expect(evaluated).toEqual([]);
});

test("forget drops a workspace index only with its last run", async () => {
  const { detector, indexer } = setup();
  await detector.sweep("P");
  detector.forget("r2");
  expect(indexer.dropped).toEqual([]);
  detector.forget("r1");
  expect(indexer.dropped).toEqual([WS1]);
  detector.forget("r3");
  expect(indexer.dropped).toEqual([WS1, WS2]);
});

test("a sweep whose indexing runs past its budget compares nothing", async () => {
  const indexer = fakeIndexer();
  const { detector, clock, evaluated } = setup({ indexer });
  indexer.onIndex = () => {
    clock.now += 31_000;
  };
  expect(await detector.sweep("P")).toEqual({ compared: 0, partial: true });
  expect(indexer.calls).toEqual([`index ${WS1}`]);
  expect(evaluated).toEqual([]);
});
