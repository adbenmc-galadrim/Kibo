import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DUPLICATION_SETTINGS } from "@kibo/schema";
import { runGit } from "../runs/workspace-prep";
import { cleanupTmp, commit, git, repo, tmp, worktree } from "../testing/git-test-kit";
import { createOverlapDetector, type DetectorSpace } from "./detector";
import { sha256Hex } from "./hash";
import { type OverlapStore, openOverlapStore } from "./store";
import { createWorkspaceIndexer, nodeIndexFs } from "./workspace-index";

const BASE_FILES = 2_000;
const CHANGED_FILES = 300;
const WORKSPACES = 3;
const MAX_LATENCY_MS = 500;
const PAUSE_MS = 20;

let spaces: DetectorSpace[] = [];
let store: OverlapStore;

const repetitive = (w: number, f: number): string =>
  [
    `export const feature${w}x${f} = true;`,
    ...Array.from(
      { length: 160 },
      (_, i) => `  const value${(i + f) % 40} = transform${(i + f) % 8}(input.field, "shared");`,
    ),
  ].join("\n");

async function changedWorkspace(repoDir: string, w: number, baseHead: string): Promise<DetectorSpace> {
  const key = await worktree(repoDir, `ws-${w}`);
  mkdirSync(join(key, "src/feat"), { recursive: true });
  for (let f = 0; f < CHANGED_FILES; f++)
    writeFileSync(join(key, `src/feat/w${w}-${f}.ts`), repetitive(w, f));
  const ws = { key, kind: "worktree" as const, worktreeName: `ws-${w}`, baseHead };
  return { ws, runs: [{ key, runId: `r${w}`, startedAt: w }], allRunIds: [`r${w}`] };
}

beforeAll(async () => {
  const repoDir = await repo();
  mkdirSync(join(repoDir, "src/base"), { recursive: true });
  for (let i = 0; i < BASE_FILES; i++)
    writeFileSync(join(repoDir, `src/base/b${i}.ts`), `export const base${i} = ${i};\n`);
  await git(["add", "."], repoDir);
  await git([...commit, "-m", "base"], repoDir);
  const baseHead = await git(["rev-parse", "HEAD"], repoDir);
  spaces = [];
  for (let w = 0; w < WORKSPACES; w++) spaces.push(await changedWorkspace(repoDir, w, baseHead));
  store = openOverlapStore(tmp());
}, 60_000);

afterAll(() => {
  store.close();
  cleanupTmp();
});

async function latencies(during: Promise<unknown>): Promise<number[]> {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => new Response(null, { status: 204 }),
  });
  const seen: number[] = [];
  let busy = true;
  void during.finally(() => {
    busy = false;
  });
  try {
    while (busy) {
      const due = performance.now() + PAUSE_MS;
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      await fetch(`http://127.0.0.1:${server.port}/hook`, { method: "POST" });
      seen.push(performance.now() - due);
    }
  } finally {
    server.stop(true);
  }
  return seen;
}

test("a hook request is answered quickly while a large sweep runs", async () => {
  const log = () => {};
  const detector = createOverlapDetector({
    store,
    indexer: createWorkspaceIndexer({ git: runGit, fs: nodeIndexFs, now: Date.now, hash: sha256Hex, log }),
    workspaces: async () => spaces,
    gone: () => false,
    projectOf: () => "P",
    settings: () => DEFAULT_DUPLICATION_SETTINGS,
    autoLinker: null,
    hash: sha256Hex,
    runName: (runId) => runId,
    moment: () => {},
    emit: () => {},
    now: Date.now,
    log,
  });
  const sweep = detector.sweep("P");
  const seen = await latencies(sweep);
  const result = await sweep;
  expect(result.compared).toBe(3);
  expect(seen.length).toBeGreaterThan(3);
  const highest = [...seen]
    .sort((x, y) => y - x)
    .slice(0, 5)
    .map((ms) => Math.round(ms));
  expect({ highestLatenciesMs: highest }).toEqual({
    highestLatenciesMs: highest.filter((ms) => ms < MAX_LATENCY_MS),
  });
}, 120_000);
