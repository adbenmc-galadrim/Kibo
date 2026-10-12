import { describe, expect, test } from "bun:test";
import { codeLines, indexOf, settingsWith } from "./arbitraries.test-helper";
import { findOverlaps } from "./compare";
import { sha256 } from "./test-hash.test-helper";

const settings = settingsWith();
const find = (a: ReturnType<typeof indexOf>, b: ReturnType<typeof indexOf>, s = settings) =>
  findOverlaps(a, b, s, sha256);
const keys = (a: ReturnType<typeof indexOf>, b: ReturnType<typeof indexOf>, s = settings) =>
  find(a, b, s).map((c) => c.key);
const shared = codeLines("shared", 8);

describe("file criterion", () => {
  test("the same path with different contents", () => {
    const found = find(
      indexOf("A", [{ path: "src/a.ts", texts: ["const one = 1;"] }]),
      indexOf("B", [{ path: "src/a.ts", texts: ["const two = 2;"] }]),
    );
    expect(found).toEqual([
      {
        kind: "file",
        key: "file:src/a.ts",
        a: { path: "src/a.ts", start: null },
        b: { path: "src/a.ts", start: null },
        name: null,
        lines: null,
        chars: null,
      },
    ]);
  });

  test("the same path with the same contents is a copy", () => {
    const same = { path: "src/a.ts", texts: [...shared, "export const formatDate = 1;"] };
    expect(find(indexOf("A", [same]), indexOf("B", [same]))).toEqual([]);
  });

  test("deleted on one side and present on the other", () => {
    expect(
      keys(
        indexOf("A", [{ path: "src/a.ts", status: "deleted" }]),
        indexOf("B", [{ path: "src/a.ts", texts: ["x"] }]),
      ),
    ).toEqual(["file:src/a.ts"]);
  });

  test("the same export name at the same path is only a file overlap with the name", () => {
    const found = find(
      indexOf("A", [{ path: "src/a.ts", texts: ["export const formatDate = 1;"] }]),
      indexOf("B", [{ path: "src/a.ts", texts: ["export const formatDate = 2;"] }]),
    );
    expect(found.map((c) => [c.key, c.name])).toEqual([["file:src/a.ts", "formatDate"]]);
  });
});

describe("tests in file and export criteria", () => {
  test("a test file changed on both sides is a file overlap", () => {
    expect(
      keys(
        indexOf("A", [{ path: "src/a.test.ts", texts: ["one"] }]),
        indexOf("B", [{ path: "src/a.test.ts", texts: ["two"] }]),
      ),
    ).toEqual(["file:src/a.test.ts"]);
  });

  test("an export added in two test helpers is an export overlap", () => {
    expect(
      keys(
        indexOf("A", [{ path: "src/a.test.ts", texts: ["export const makeUser = 1;"] }]),
        indexOf("B", [{ path: "src/b.test.ts", texts: ["export const makeUser = 2;"] }]),
      ),
    ).toEqual(["export:makeUser"]);
  });

  test("other ignored paths stay out of every criterion", () => {
    expect(
      keys(
        indexOf("A", [
          { path: "bun.lock", texts: ["one"] },
          { path: ".env", texts: ["a"] },
        ]),
        indexOf("B", [
          { path: "bun.lock", texts: ["two"] },
          { path: ".env", texts: ["b"] },
        ]),
      ),
    ).toEqual([]);
  });
});

describe("export criterion", () => {
  test("the same name added in two files", () => {
    const found = find(
      indexOf("A", [{ path: "src/a.ts", texts: ["export function formatDate() {"] }]),
      indexOf("B", [{ path: "src/b.ts", texts: ["export const formatDate = () => 1;"] }]),
    );
    expect(found).toEqual([
      {
        kind: "export",
        key: "export:formatDate",
        a: { path: "src/a.ts", start: null },
        b: { path: "src/b.ts", start: null },
        name: "formatDate",
        lines: null,
        chars: null,
      },
    ]);
  });

  test("a name made generic by the project is skipped", () => {
    const a = indexOf("A", [{ path: "src/a.ts", texts: ["export const formatDate = 1;"] }]);
    const b = indexOf("B", [{ path: "src/b.ts", texts: ["export const formatDate = 2;"] }]);
    expect(keys(a, b, settingsWith({ genericExports: ["formatDate"] }))).toEqual([]);
  });

  test("short and generic names in the index are skipped", () => {
    const a = indexOf("A", [{ path: "src/a.ts", texts: ["x"], exports: ["abc", "Props"] }]);
    const b = indexOf("B", [{ path: "src/b.ts", texts: ["y"], exports: ["abc", "Props"] }]);
    expect(keys(a, b)).toEqual([]);
  });

  test("other languages have no export criterion", () => {
    const a = indexOf("A", [{ path: "a.py", texts: [...shared, "z"], exports: ["formatDate"] }]);
    const b = indexOf("B", [
      { path: "a.py", texts: ["w"], exports: ["formatDate"] },
      { path: "b.py", texts: shared, exports: ["formatDate"] },
    ]);
    expect(find(a, b).map((c) => c.kind)).toEqual(["block", "file"]);
  });
});

describe("block criterion", () => {
  test("a common block in different files", () => {
    const found = find(
      indexOf("A", [{ path: "src/a.ts", texts: ["const before = 0;", ...shared] }]),
      indexOf("B", [{ path: "src/b.ts", texts: ["const x = 1;", "const y = 2;", ...shared] }]),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      kind: "block",
      a: { path: "src/a.ts", start: 2 },
      b: { path: "src/b.ts", start: 3 },
      lines: 8,
      name: null,
    });
    expect(found[0]?.key).toMatch(/^block:[0-9a-f]{64}$/);
    expect(found[0]?.chars).toBeGreaterThanOrEqual(160);
  });

  test("a block under 160 characters is skipped", () => {
    const short = Array.from({ length: 10 }, (_, i) => `v${i}();`);
    expect(
      keys(
        indexOf("A", [{ path: "src/a.ts", texts: short }]),
        indexOf("B", [{ path: "src/b.ts", texts: short }]),
      ),
    ).toEqual([]);
  });

  test("tests are left out of blocks unless compared", () => {
    const a = indexOf("A", [{ path: "src/a.test.ts", texts: shared }]);
    const b = indexOf("B", [{ path: "src/b.test.ts", texts: shared }]);
    expect(keys(a, b)).toEqual([]);
    expect(find(a, b, settingsWith({ compareTests: true })).map((c) => c.kind)).toEqual(["block"]);
  });

  test("a four line block is found with minLines 4", () => {
    const four = codeLines("four", 4).map((l) => `${l} // ${"x".repeat(30)}`);
    const a = indexOf("A", [{ path: "src/a.ts", texts: four }]);
    const b = indexOf("B", [{ path: "src/b.ts", texts: four }]);
    expect(keys(a, b)).toEqual([]);
    expect(find(a, b, settingsWith({ minLines: 4 })).map((c) => [c.kind, c.lines])).toEqual([["block", 4]]);
  });

  test("a block at the same path is left to the file criterion", () => {
    const a = indexOf("A", [{ path: "src/a.ts", texts: [...shared, "const one = 1;"] }]);
    const b = indexOf("B", [{ path: "src/a.ts", texts: [...shared, "const two = 2;"] }]);
    expect(find(a, b).map((c) => c.kind)).toEqual(["file"]);
  });

  test("clipped files have no block", () => {
    const a = indexOf("A", [{ path: "src/a.ts", texts: shared, clipped: true }]);
    const b = indexOf("B", [{ path: "src/b.ts", texts: shared }]);
    expect(keys(a, b)).toEqual([]);
  });

  test("a truncated index keeps file and export but drops blocks", () => {
    const a = indexOf("A", [
      { path: "src/a.ts", texts: [...shared, "export const formatDate = 1;"] },
      { path: "src/c.ts", texts: ["one"] },
    ]);
    const b = indexOf(
      "B",
      [
        { path: "src/b.ts", texts: [...shared, "export const formatDate = 2;"] },
        { path: "src/c.ts", texts: ["two"] },
      ],
      { truncated: true },
    );
    expect(find(a, b).map((c) => c.kind)).toEqual(["export", "file"]);
  });

  test("the same block twice gives one candidate per key", () => {
    const a = indexOf("A", [{ path: "src/a.ts", texts: shared }]);
    const b = indexOf("B", [
      { path: "src/b.ts", texts: shared },
      { path: "src/c.ts", texts: shared },
    ]);
    const found = find(a, b);
    expect(found).toHaveLength(1);
    expect(found[0]?.b.path).toBe("src/b.ts");
  });
});

describe("findOverlaps", () => {
  const a = indexOf("A", [
    { path: "src/z.ts", texts: ["z1"] },
    { path: "src/a.ts", texts: ["export const formatDate = 1;", ...shared] },
  ]);
  const b = indexOf("B", [
    { path: "src/z.ts", texts: ["z2"] },
    { path: "src/b.ts", texts: ["export const formatDate = 2;", ...shared] },
  ]);

  test("sorts by kind then key", () => {
    expect(find(a, b).map((c) => c.kind)).toEqual(["block", "export", "file"]);
  });

  test("gives the same keys with the sides swapped", () => {
    expect(keys(b, a)).toEqual(keys(a, b));
    const swapped = find(b, a).find((c) => c.kind === "export");
    expect(swapped?.a.path).toBe("src/b.ts");
  });
});
