import { describe, expect, test } from "bun:test";
import { lineHashes, normalizeLine } from "./normalize";
import { sha256 } from "./test-hash.test-helper";

describe("normalizeLine", () => {
  test("trims and collapses inner spaces", () => {
    expect(normalizeLine("  const a   =  1 ; ")).toBe("const a = 1 ;");
  });

  test.each(["", "   ", "// x", "# x", "/* x", " * x", "*/", "<!-- x", "-->", "}", "});", "],", "{ }"])(
    "drops %p",
    (raw) => {
      expect(normalizeLine(raw)).toBeNull();
    },
  );

  test("keeps a trailing comment", () => {
    expect(normalizeLine("return x; // fin")).toBe("return x; // fin");
  });
});

describe("lineHashes", () => {
  test("hashes kept lines with their file line numbers", () => {
    const lines = [
      { line: 1, text: "a" },
      { line: 2, text: "" },
      { line: 3, text: " b " },
    ];
    expect(lineHashes(lines, sha256)).toEqual([
      { line: 1, hash: sha256("a").slice(0, 16), chars: 1 },
      { line: 3, hash: sha256("b").slice(0, 16), chars: 1 },
    ]);
  });
});
