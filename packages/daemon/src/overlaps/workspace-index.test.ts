import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DUPLICATION_SETTINGS, type IndexedFile } from "@kibo/schema";
import { cleanupTmp, commit, git, repo, worktree } from "../agents/git-test-kit";
import { type GitRunner, runGit } from "../agents/workspace-prep";
import { sha256Hex as testHash } from "./hash";
import type { WorkspaceRef } from "./workspace";
import { createWorkspaceIndexer, type IndexFs, nodeIndexFs } from "./workspace-index";

afterEach(cleanupTmp);

const SETTINGS = DEFAULT_DUPLICATION_SETTINGS;
const A_TS = 'import { helper } from "./helper";\n\nexport function formatDate(d) {\n  return d;\n}\n';

async function workspace(): Promise<{ ws: WorkspaceRef; repoDir: string }> {
  const repoDir = await repo();
  writeFileSync(join(repoDir, "README.md"), "# Projet\n\nintro\n");
  await git(["add", "."], repoDir);
  await git([...commit, "-m", "base"], repoDir);
  const wt = await worktree(repoDir, "bou-12");
  const baseHead = await git(["rev-parse", "HEAD"], wt);
  return { ws: { key: wt, kind: "worktree", worktreeName: "wt-bou-12", baseHead }, repoDir };
}

function put(ws: WorkspaceRef, path: string, content: string | Buffer): void {
  mkdirSync(join(ws.key, path, ".."), { recursive: true });
  writeFileSync(join(ws.key, path), content);
}

function setup(git: GitRunner = runGit) {
  const logs: string[] = [];
  let reads = 0;
  const fs: IndexFs = {
    stat: nodeIndexFs.stat,
    read: (p, max) => {
      reads++;
      return nodeIndexFs.read(p, max);
    },
  };
  const indexer = createWorkspaceIndexer({
    git,
    fs,
    now: () => 42,
    hash: testHash,
    log: (line) => logs.push(line),
  });
  return { indexer, logs, reads: () => reads };
}

const line = (n: number, text: string) => ({
  line: n,
  hash: testHash(text).slice(0, 16),
  chars: text.length,
});

function fingerprint(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .sort()
    .map((p) => {
      const full = join(dir, p);
      const s = statSync(full);
      return s.isFile() ? `${p}:${s.mtimeMs}:${testHash(readFileSync(full, "latin1"))}` : `${p}/`;
    });
}

describe("workspace indexer", () => {
  test("indexes the changed files, skipping ignored, binary, secret and too large ones", async () => {
    const { ws } = await workspace();
    put(ws, "src/a.ts", A_TS);
    put(ws, "README.md", "# Projet\n\nintro\nsuite ajoutée\n");
    put(ws, "dist/x.js", "export const built = 1;\n");
    put(ws, "bun.lock", "{}\n");
    put(ws, "img.png", "png\n");
    put(ws, "bin.dat", Buffer.from([0x61, 0x00, 0x62]));
    put(ws, ".env", "TOKEN=1\n");
    put(ws, "big.ts", "x".repeat(512 * 1024 + 1));
    put(ws, "a.test.ts", "export const sample = 1;\n");
    const { indexer, logs } = setup();
    const index = await indexer.index(ws, ["r1"], SETTINGS);
    expect(index.files.map((f) => f.path)).toEqual(["README.md", "a.test.ts", "src/a.ts"]);
    expect(index).toMatchObject({ key: ws.key, runIds: ["r1"], baseHead: ws.baseHead, truncated: false });
    expect(index.partial).toBe(false);
    expect(index.at).toBe(42);
    expect(logs.join("\n")).toContain("big.ts");
    expect(logs.join("\n")).toContain(".env");
    const a = index.files[2] as IndexedFile;
    expect(a).toEqual({
      path: "src/a.ts",
      status: "added",
      added: 5,
      removed: 0,
      hash: testHash(A_TS),
      exports: ["formatDate"],
      imports: [{ spec: "./helper", names: ["helper"], line: 1 }],
      lines: [
        line(1, 'import { helper } from "./helper";'),
        line(3, "export function formatDate(d) {"),
        line(4, "return d;"),
      ],
      clipped: false,
    });
    expect(index.files[0]).toMatchObject({
      status: "modified",
      added: 1,
      removed: 0,
      lines: [line(4, "suite ajoutée")],
    });
    expect(indexer.cached(ws)).toEqual(index);
  });

  test("a secret file is reported once per workspace, not on every sweep", async () => {
    const { ws } = await workspace();
    put(ws, ".env.example", "TOKEN=1\n");
    const { indexer, logs } = setup();
    const secretLogs = () => logs.filter((l) => l.includes("secret file .env.example")).length;
    await indexer.index(ws, ["r1"], SETTINGS);
    await indexer.index(ws, ["r1"], SETTINGS);
    await indexer.indexFile(ws, ".env.example", SETTINGS);
    expect(secretLogs()).toBe(1);
    indexer.drop(ws.key);
    await indexer.index(ws, ["r2"], SETTINGS);
    expect(secretLogs()).toBe(2);
  });

  test("past 500 changed files the index is truncated to the first 500 paths without lines", async () => {
    const { ws } = await workspace();
    for (let i = 0; i < 501; i++)
      put(ws, `f${String(i).padStart(3, "0")}.ts`, `export const value${i} = ${i};\n`);
    const index = await setup().indexer.index(ws, ["r1"], SETTINGS);
    expect(index.truncated).toBe(true);
    expect(index.files).toHaveLength(500);
    expect(index.files[499]?.path).toBe("f499.ts");
    expect(index.files.every((f) => f.lines.length === 0)).toBe(true);
    expect(index.files[0]?.exports).toEqual(["value0"]);
  });

  test("a file with more than 20 000 added lines is clipped", async () => {
    const { ws } = await workspace();
    put(ws, "many.txt", Array.from({ length: 20_001 }, (_, i) => `l${i}`).join("\n"));
    const index = await setup().indexer.index(ws, ["r1"], SETTINGS);
    expect(index.files[0]).toMatchObject({ path: "many.txt", clipped: true, lines: [], added: 20_001 });
  });

  test("indexFile refreshes one file of the cached index", async () => {
    const { ws } = await workspace();
    put(ws, "src/a.ts", A_TS);
    put(ws, "src/b.ts", "export const other = 1;\n");
    const { indexer } = setup();
    const before = await indexer.index(ws, ["r1"], SETTINGS);
    put(ws, "src/a.ts", "export function formatDay(d) {\n  return d;\n}\n");
    const after = await indexer.indexFile(ws, "src/a.ts", SETTINGS);
    expect(after?.files.find((f) => f.path === "src/a.ts")?.exports).toEqual(["formatDay"]);
    expect(after?.files.find((f) => f.path === "src/b.ts")).toEqual(
      before.files.find((f) => f.path === "src/b.ts"),
    );
    expect(after?.runIds).toEqual(["r1"]);
    expect(indexer.cached(ws)).toEqual(after);
    put(ws, "src/c.ts", "export const third = 1;\n");
    expect((await indexer.indexFile(ws, "src/c.ts", SETTINGS))?.files.map((f) => f.path)).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);
  });

  test("indexFile of an ignored path gives null", async () => {
    const { ws } = await workspace();
    put(ws, "dist/x.js", "x\n");
    const { indexer } = setup();
    expect(await indexer.indexFile(ws, "dist/x.js", SETTINGS)).toBeNull();
    expect(await indexer.indexFile(ws, ".env", SETTINGS)).toBeNull();
  });

  test("a cached index is only reused for the same base head", async () => {
    const { ws: origin } = await workspace();
    put(origin, "src/a.ts", A_TS);
    await git(["add", "."], origin.key);
    await git([...commit, "-m", "first run"], origin.key);
    put(origin, "src/a.ts", `${A_TS}export const extra = 1;\n`);
    const resumed: WorkspaceRef = { ...origin, baseHead: await git(["rev-parse", "HEAD"], origin.key) };
    const { indexer } = setup();
    const shallow = await indexer.index(resumed, ["r2"], SETTINGS);
    expect(shallow.files.map((f) => [f.path, f.exports])).toEqual([["src/a.ts", ["extra"]]]);
    expect(indexer.cached(origin)).toBeNull();
    expect(indexer.cached(resumed)).toEqual(shallow);
    const full = await indexer.index(origin, ["r1", "r2"], SETTINGS);
    expect(full.files.map((f) => [f.path, f.status, f.exports])).toEqual([
      ["src/a.ts", "added", ["formatDate", "extra"]],
    ]);
    expect(indexer.cached(origin)).toEqual(full);
    expect(indexer.cached(resumed)).toBeNull();
  });

  test("drop forgets the workspace", async () => {
    const { ws } = await workspace();
    const { indexer } = setup();
    await indexer.index(ws, ["r1"], SETTINGS);
    indexer.drop(ws.key);
    expect(indexer.cached(ws)).toBeNull();
  });

  test("indexing never writes in the workspace", async () => {
    const { ws } = await workspace();
    put(ws, "src/a.ts", A_TS);
    put(ws, "README.md", "# Projet\n\nintro\nsuite\n");
    const before = fingerprint(ws.key);
    const { indexer } = setup();
    await indexer.index(ws, ["r1"], SETTINGS);
    await indexer.indexFile(ws, "README.md", SETTINGS);
    expect(fingerprint(ws.key)).toEqual(before);
  });

  test("unchanged size and mtime mean no second read", async () => {
    const { ws } = await workspace();
    put(ws, "src/a.ts", A_TS);
    put(ws, "src/b.ts", "export const other = 1;\n");
    const { indexer, reads } = setup();
    await indexer.index(ws, ["r1"], SETTINGS);
    const first = reads();
    expect(first).toBe(2);
    await indexer.index(ws, ["r1"], SETTINGS);
    expect(reads()).toBe(first);
  });

  test("a git past its timeout gives a partial index without throwing", async () => {
    const { ws } = await workspace();
    put(ws, "src/a.ts", A_TS);
    const timeouts: (number | undefined)[] = [];
    const slow: GitRunner = async (args, _cwd, timeoutMs) => {
      timeouts.push(timeoutMs);
      return { code: 1, stdout: "", stderr: `git ${args[0]} timed out after 10s` };
    };
    const { indexer, logs } = setup(slow);
    const index = await indexer.index(ws, ["r1"], SETTINGS);
    expect(index).toMatchObject({ partial: true, files: [] });
    expect(timeouts[0]).toBe(10_000);
    expect(logs.join("\n")).toContain("détection partielle");
  });

  test("a git that throws gives a partial index", async () => {
    const { ws } = await workspace();
    const broken: GitRunner = () => Promise.reject(new Error("spawn git ENOENT"));
    expect((await setup(broken).indexer.index(ws, ["r1"], SETTINGS)).partial).toBe(true);
  });
});
