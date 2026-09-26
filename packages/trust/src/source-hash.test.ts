import { expect, test } from "bun:test";
import { utf8 } from "./bytes";
import { isHashedSource, type SourceFile, sourceHash } from "./source-hash";

const files = (): SourceFile[] => [
  { path: "kibo.component.json", bytes: utf8('{"id":"burndown"}') },
  { path: "ui.tsx", bytes: utf8("export const A = 1;") },
  { path: "lib/chart.ts", bytes: utf8("export const B = 2;") },
  { path: "styles.css", bytes: utf8(".a{}") },
];

test("only manifest and ts, tsx, css sources are hashed", () => {
  expect(isHashedSource("kibo.component.json")).toBe(true);
  expect(isHashedSource("ui.tsx")).toBe(true);
  expect(isHashedSource("lib/chart.ts")).toBe(true);
  expect(isHashedSource("styles.css")).toBe(true);
  expect(isHashedSource("component.test.tsx")).toBe(false);
  expect(isHashedSource("lib/x.test.ts")).toBe(false);
  expect(isHashedSource("node_modules/react/index.ts")).toBe(false);
  expect(isHashedSource("dist/ui.js")).toBe(false);
  expect(isHashedSource(".env.ts")).toBe(false);
  expect(isHashedSource("lib/.hidden/a.ts")).toBe(false);
  expect(isHashedSource("README.md")).toBe(false);
  expect(isHashedSource("lib/data.json")).toBe(false);
});

test("excluded directories are excluded at any depth", () => {
  expect(isHashedSource("lib/dist/a.ts")).toBe(false);
  expect(isHashedSource("lib/node_modules/a.ts")).toBe(false);
});

test("hash is independent of file order", () => {
  const a = sourceHash(files());
  const b = sourceHash(files().reverse());
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(b).toBe(a);
});

test("one changed byte changes the hash", () => {
  const base = sourceHash(files());
  const changed = files();
  changed[1] = { path: "ui.tsx", bytes: utf8("export const A = 2;") };
  expect(sourceHash(changed)).not.toBe(base);
});

test("renaming a file changes the hash", () => {
  const base = sourceHash(files());
  const renamed = files();
  renamed[2] = { path: "lib/graph.ts", bytes: utf8("export const B = 2;") };
  expect(sourceHash(renamed)).not.toBe(base);
});

test("ignored files do not affect the hash", () => {
  const base = sourceHash(files());
  const extra = [
    ...files(),
    { path: "component.test.tsx", bytes: utf8("test") },
    { path: "node_modules/x/index.ts", bytes: utf8("x") },
    { path: "dist/ui.js", bytes: utf8("y") },
    { path: ".cache.ts", bytes: utf8("z") },
  ];
  expect(sourceHash(extra)).toBe(base);
});

test("encoding is path NUL size NUL bytes, sorted by path", async () => {
  const one: SourceFile[] = [{ path: "a.ts", bytes: utf8("x") }];
  const expected = new Uint8Array([...utf8("a.ts"), 0, ...utf8("1"), 0, ...utf8("x")]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", expected));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  expect(sourceHash(one)).toBe(hex);
});

test("a duplicated path is refused instead of hashed in input order", () => {
  const benign = { path: "ui.tsx", bytes: utf8("export const A = 1;") };
  const evil = { path: "ui.tsx", bytes: utf8("fetch('https://evil')") };
  expect(() => sourceHash([benign, evil])).toThrow("INVALID_INPUT");
});

test("unsafe paths are refused and never hashed", () => {
  for (const path of ["/etc/x.ts", "lib//x.ts", "lib\\x.ts", "", "lib/", "a\0.ts"]) {
    expect(() => sourceHash([{ path, bytes: utf8("") }])).toThrow("INVALID_INPUT");
    expect(isHashedSource(path)).toBe(false);
  }
});
