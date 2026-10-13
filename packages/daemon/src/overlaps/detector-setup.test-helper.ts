import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Finding } from "@kibo/core";
import {
  DEFAULT_DUPLICATION_SETTINGS,
  type DuplicationSettings,
  type MomentData,
  type WorkspaceIndex,
  type WorkspaceRun,
} from "@kibo/schema";
import { createOverlapDetector, type DetectorSpace } from "./detector";
import { type FakeIndexer, fakeIndexer, indexedFile, indexOf, wsRef } from "./detector-fakes.test-helper";
import { sha256Hex } from "./hash";
import { type OverlapStore, openOverlapStore } from "./store";

const homes: string[] = [];
const stores: OverlapStore[] = [];

export function cleanDetectors(): void {
  for (const s of stores.splice(0)) s.close();
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
}

export const WS1 = "/w/ws1";
export const WS2 = "/w/ws2";
export const run = (key: string, runId: string, startedAt: number): WorkspaceRun => ({
  key,
  runId,
  startedAt,
});
export const space = (key: string, runs: WorkspaceRun[]): DetectorSpace => ({
  ws: wsRef(key),
  runs,
  allRunIds: runs.map((r) => r.runId),
});
export const formatIn = (key: string, path: string): WorkspaceIndex =>
  indexOf(key, [indexedFile(path, ["formatDate"])]);

type Setup = { spaces?: DetectorSpace[]; settings?: DuplicationSettings; indexer?: FakeIndexer };

export function setup({
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
  const state = {
    spaces,
    settings,
    emits: 0,
    gone: new Set<string>(),
    linkerFailure: null as Error | null,
  };
  const detector = createOverlapDetector({
    store,
    indexer,
    workspaces: async () => state.spaces,
    gone: (key) => state.gone.has(key),
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
        if (state.linkerFailure) throw state.linkerFailure;
        evaluated.push({ projectId, indexes: indexes.map((i) => i.key), runs: runs.map((r) => r.runId) });
      },
    },
  });
  return { detector, store, indexer, moments, logs, evaluated, clock, state };
}

export function writeSetup() {
  const indexer = fakeIndexer();
  indexer.preload(formatIn(WS1, "src/lib/format.ts"));
  indexer.single.set(`${WS2}:src/utils/date.ts`, formatIn(WS2, "src/utils/date.ts"));
  return setup({ indexer });
}

export const staleFinding = (otherWorkspace = WS2): Finding => ({
  kind: "file",
  key: "file:src/old.ts",
  ownerRunId: "r1",
  otherRunId: "r2",
  ownerWorkspace: WS1,
  otherWorkspace,
  detail: { kind: "file", path: "src/old.ts" },
});
