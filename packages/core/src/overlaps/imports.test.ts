import { describe, expect, test } from "bun:test";
import { importsOf, resolveRelative } from "./imports";

const one = (text: string) => importsOf([{ line: 3, text }]);

describe("importsOf", () => {
  test("named imports keep the imported names", () => {
    expect(one('import { a, b as c } from "./x";')).toEqual([{ spec: "./x", names: ["a", "b"], line: 3 }]);
  });

  test("default and namespace imports have no names", () => {
    expect(one('import x from "../y";')).toEqual([{ spec: "../y", names: [], line: 3 }]);
    expect(one("import * as all from './all';")).toEqual([{ spec: "./all", names: [], line: 3 }]);
  });

  test("a default with named imports keeps the named ones", () => {
    expect(one('import x, { type T, y } from "./m";')).toEqual([{ spec: "./m", names: ["T", "y"], line: 3 }]);
  });

  test("side effect, dynamic, require and re-export are found", () => {
    expect(one('import "./side";')).toEqual([{ spec: "./side", names: [], line: 3 }]);
    expect(one('const z = await import("./z");')).toEqual([{ spec: "./z", names: [], line: 3 }]);
    expect(one("const w = require('./w');")).toEqual([{ spec: "./w", names: [], line: 3 }]);
    expect(one('export { q, r as s } from "./v";')).toEqual([{ spec: "./v", names: ["q", "r"], line: 3 }]);
    expect(one('export * from "./star";')).toEqual([{ spec: "./star", names: [], line: 3 }]);
  });

  test("packages and aliases are ignored", () => {
    expect(one('import { a } from "react";')).toEqual([]);
    expect(one('import { a } from "@/lib";')).toEqual([]);
    expect(one('import { a } from "~/x";')).toEqual([]);
  });

  test("keeps line numbers across lines", () => {
    const found = importsOf([
      { line: 1, text: 'import { a } from "./a";' },
      { line: 7, text: 'const b = require("./b"), c = require("./c");' },
    ]);
    expect(found.map((i) => [i.spec, i.line])).toEqual([
      ["./a", 1],
      ["./b", 7],
      ["./c", 7],
    ]);
  });
});

describe("resolveRelative", () => {
  test("tries the path, the extensions then the index files in order", () => {
    const tried: string[] = [];
    resolveRelative("src/a/b.ts", "../lib/format", (p) => {
      tried.push(p);
      return false;
    });
    expect(tried.slice(0, 4)).toEqual([
      "src/lib/format",
      "src/lib/format.ts",
      "src/lib/format.tsx",
      "src/lib/format.mts",
    ]);
    expect(tried[9]).toBe("src/lib/format/index.ts");
    expect(tried).toHaveLength(17);
  });

  test("returns the first existing file", () => {
    const files = new Set(["src/lib/format.js", "src/lib/format/index.ts"]);
    expect(resolveRelative("src/a/b.ts", "../lib/format", (p) => files.has(p))).toBe("src/lib/format.js");
  });

  test("returns null when nothing exists", () => {
    expect(resolveRelative("src/a/b.ts", "./c", () => false)).toBeNull();
  });

  test("a folder spec resolves to its index", () => {
    const files = new Set(["src/a/index.tsx"]);
    expect(resolveRelative("src/a/b.ts", "./", (p) => files.has(p))).toBe("src/a/index.tsx");
  });

  test("a spec above the root resolves to nothing", () => {
    expect(resolveRelative("a.ts", "../x", () => true)).toBeNull();
  });
});
