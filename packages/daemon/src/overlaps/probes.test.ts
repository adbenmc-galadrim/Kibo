import { afterEach, expect, test } from "bun:test";
import { mkdirSync, realpathSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DUPLICATION_LIMITS, type IndexedFile, type WorkspaceIndex } from "@kibo/schema";
import { cleanupTmp, tmp } from "../agents/git-test-kit";
import { createImportProbes, nodeProbeFs, type ProbeFs } from "./probes";

afterEach(cleanupTmp);

const file = (path: string, status: IndexedFile["status"]): IndexedFile => ({
  path,
  status,
  added: 1,
  removed: 0,
  hash: null,
  exports: [],
  imports: [],
  lines: [],
  clipped: false,
});

function workspace(files: Record<string, string>, indexed: IndexedFile[] = []): WorkspaceIndex {
  const key = realpathSync(tmp());
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(key, path)), { recursive: true });
    writeFileSync(join(key, path), content);
  }
  return { key, runIds: ["r1"], baseHead: "base", files: indexed, truncated: false, partial: false, at: 1 };
}

const FORMAT = "export function formatDate(d: Date) {\n  return d.toISOString();\n}\n";

test("an import resolved to a file added since the base is added, with its current exports", () => {
  const ws = workspace({ "src/lib/format.ts": FORMAT, "src/pages/track.ts": "" }, [
    file("src/lib/format.ts", "added"),
  ]);
  const probe = createImportProbes().probe(ws);
  expect(probe("src/pages/track.ts", "../lib/format")).toEqual({
    path: "src/lib/format.ts",
    added: true,
    exports: ["formatDate"],
  });
});

test("a file of the base is not added, and keeps the exports of its current content", () => {
  const ws = workspace(
    { "src/lib/format.ts": `${FORMAT}export const parseDate = (s: string) => new Date(s);\n` },
    [file("src/lib/format.ts", "modified")],
  );
  expect(createImportProbes().probe(ws)("src/pages/track.ts", "../lib/format")).toEqual({
    path: "src/lib/format.ts",
    added: false,
    exports: ["formatDate", "parseDate"],
  });
  expect(createImportProbes().probe(ws)("src/pages/track.ts", "../lib/index")).toBeNull();
});

test("a missing module, a path above the workspace, a folder or a symlink going out resolve to null", () => {
  const outside = realpathSync(tmp());
  writeFileSync(join(outside, "secret.ts"), FORMAT);
  const ws = workspace({ "src/lib/real.ts": FORMAT });
  mkdirSync(join(ws.key, "src/dir.ts"));
  symlinkSync(join(outside, "secret.ts"), join(ws.key, "src/lib/link.ts"));
  symlinkSync(outside, join(ws.key, "src/out"));
  const probe = createImportProbes().probe(ws);
  expect(probe("src/pages/a.ts", "../lib/absent")).toBeNull();
  expect(probe("src/a.ts", "../../x")).toBeNull();
  expect(probe("src/a.ts", "./dir.ts")).toBeNull();
  expect(probe("src/a.ts", "./lib/link")).toBeNull();
  expect(probe("src/a.ts", "./out/secret")).toBeNull();
  expect(probe("src/a.ts", "@/lib/real")).toBeNull();
});

test("reads are bounded: a binary or oversized module is null", () => {
  const big = "x".repeat(DUPLICATION_LIMITS.fileBytes + 1);
  const ws = workspace({
    "src/bin.ts": `export const a\u0000b = 1;\n`,
    "src/big.ts": big,
    "src/ok.ts": FORMAT,
  });
  const probe = createImportProbes().probe(ws);
  expect(probe("src/a.ts", "./bin")).toBeNull();
  expect(probe("src/a.ts", "./big")).toBeNull();
  expect(probe("src/a.ts", "./ok")?.exports).toEqual(["formatDate"]);
});

test("a module is read once while its size and mtime do not change", () => {
  const ws = workspace({ "src/lib/format.ts": FORMAT });
  const reads: string[] = [];
  const fs: ProbeFs = {
    ...nodeProbeFs,
    read(path, max) {
      reads.push(path);
      return nodeProbeFs.read(path, max);
    },
  };
  const probes = createImportProbes({ fs });
  probes.probe(ws)("src/a.ts", "./lib/format");
  probes.probe(ws)("src/b.ts", "./lib/format.ts");
  expect(reads).toHaveLength(1);
  const path = join(ws.key, "src/lib/format.ts");
  writeFileSync(path, `${FORMAT}export const parseDate = 1;\n`);
  expect(statSync(path).size).toBeGreaterThan(FORMAT.length);
  expect(probes.probe(ws)("src/a.ts", "./lib/format")?.exports).toEqual(["formatDate", "parseDate"]);
  expect(reads).toHaveLength(2);
});
