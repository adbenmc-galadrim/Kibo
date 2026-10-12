import {
  DEFAULT_DUPLICATION_SETTINGS,
  type DuplicationSettings,
  type IndexedFile,
  type WorkspaceIndex,
} from "@kibo/schema";
import fc from "fast-check";
import { exportsOf } from "./exports";
import { importsOf } from "./imports";
import { lineHashes } from "./normalize";
import { sha256 } from "./test-hash.test-helper";

export type FileSpec = {
  path: string;
  texts?: readonly string[];
  status?: IndexedFile["status"];
  hash?: string | null;
  exports?: readonly string[];
  clipped?: boolean;
};

export function fileOf(spec: FileSpec): IndexedFile {
  const texts = spec.texts ?? [];
  const numbered = texts.map((text, i) => ({ line: i + 1, text }));
  const status = spec.status ?? "added";
  return {
    path: spec.path,
    status,
    added: texts.length,
    removed: 0,
    hash: spec.hash !== undefined ? spec.hash : status === "deleted" ? null : sha256(texts.join("\n")),
    exports: spec.exports ? [...spec.exports] : exportsOf(texts, DEFAULT_DUPLICATION_SETTINGS.genericExports),
    imports: importsOf(numbered),
    lines: spec.clipped ? [] : lineHashes(numbered, sha256),
    clipped: spec.clipped ?? false,
  };
}

export function indexOf(
  key: string,
  files: readonly FileSpec[],
  extra: Partial<WorkspaceIndex> = {},
): WorkspaceIndex {
  return {
    key,
    runIds: [`run-${key}`],
    baseHead: "base",
    files: files.map(fileOf),
    truncated: false,
    partial: false,
    at: 0,
    ...extra,
  };
}

export const settingsWith = (patch: Partial<DuplicationSettings> = {}): DuplicationSettings => ({
  ...DEFAULT_DUPLICATION_SETTINGS,
  ...patch,
});

export const codeLines = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `const ${prefix}Value${i} = compute("${prefix}", ${i});`);

export const arbLine = fc.string({ unit: fc.constantFrom(..."ab cd;{}()[],/*#=-x"), maxLength: 60 });

export const arbLines = (prefix: string) =>
  fc.array(arbLine, { maxLength: 40 }).map((lines) => lines.map((line) => `${prefix}${line}`));

export const arbSettings = fc.record({
  minLines: fc.integer({ min: 4, max: 50 }),
  compareTests: fc.boolean(),
});

const arbPath = fc.constantFrom("src/a.ts", "src/b.ts", "src/lib/c.ts", "src/d.test.ts", "src/e.py", "f.tsx");

export const arbFile = (path: string, shared: readonly string[]) =>
  fc
    .record({
      own: arbLines(path),
      withShared: fc.boolean(),
      status: fc.constantFrom<IndexedFile["status"]>("added", "modified", "deleted"),
      names: fc.subarray(["formatDate", "parseDate", "Props", "abc", "HttpClient"]),
    })
    .map(({ own, withShared, status, names }) =>
      fileOf({
        path,
        status,
        texts: [...own, ...(withShared ? shared : []), ...names.map((n) => `export const ${n} = 1;`)],
      }),
    );

export const arbIndex = (key: string, shared: readonly string[]) =>
  fc
    .uniqueArray(arbPath, { maxLength: 5 })
    .chain((paths) => fc.tuple(...paths.map((p) => arbFile(p, shared))))
    .map(
      (files): WorkspaceIndex => ({
        key,
        runIds: [`run-${key}`],
        baseHead: "base",
        files,
        truncated: false,
        partial: false,
        at: 0,
      }),
    );
