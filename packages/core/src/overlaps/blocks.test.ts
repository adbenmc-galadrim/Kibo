import { describe, expect, test } from "bun:test";
import type { LineHash } from "@kibo/schema";
import { blockKey, commonBlocks } from "./blocks";
import { lineHashes } from "./normalize";
import { sha256 } from "./test-hash.test-helper";

const text = (prefix: string, count: number, width = 24) =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i} `.padEnd(width, "x"));

const hashed = (texts: readonly string[], firstLine = 1): LineHash[] =>
  lineHashes(
    texts.map((t, i) => ({ line: firstLine + i, text: t })),
    sha256,
  );

const shared = text("shared", 8);

describe("commonBlocks", () => {
  test("finds an eight line block with its file lines", () => {
    const a = hashed([...text("a", 3), ...shared, ...text("a2", 2)]);
    const b = hashed([...text("b", 5), ...shared], 10);
    const blocks = commonBlocks(a, b, 8, sha256);
    expect(blocks).toEqual([{ aStart: 3, bStart: 5, lines: 8, chars: 192, aLine: 4, bLine: 15 }]);
  });

  test("a seven line block is below eight lines", () => {
    const a = hashed([...text("a", 2), ...shared.slice(0, 7)]);
    const b = hashed(shared.slice(0, 7));
    expect(commonBlocks(a, b, 8, sha256)).toEqual([]);
    expect(commonBlocks(a, b, 4, sha256)).toHaveLength(1);
  });

  test("returns short-character blocks, the char threshold is applied later", () => {
    const short = text("s", 10, 5).map((t) => t.slice(0, 5));
    const blocks = commonBlocks(hashed(short), hashed(short), 8, sha256);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.chars).toBeLessThan(160);
  });

  test("two disjoint blocks", () => {
    const other = text("other", 8);
    const a = hashed([...shared, ...text("a", 3), ...other]);
    const b = hashed([...other, ...text("b", 4), ...shared]);
    const blocks = commonBlocks(a, b, 8, sha256);
    expect(blocks.map((x) => [x.aStart, x.bStart])).toEqual([
      [0, 12],
      [11, 0],
    ]);
  });

  test("a twelve line block is one block without sub-blocks", () => {
    const twelve = text("twelve", 12);
    const blocks = commonBlocks(hashed(twelve), hashed([...text("b", 1), ...twelve]), 8, sha256);
    expect(blocks).toEqual([expect.objectContaining({ aStart: 0, bStart: 1, lines: 12 })]);
  });

  test("the same block twice in b gives two blocks", () => {
    const b = hashed([...shared, ...text("gap", 2), ...shared]);
    const blocks = commonBlocks(hashed(shared), b, 8, sha256);
    expect(blocks.map((x) => x.bStart)).toEqual([0, 10]);
  });
});

describe("blockKey", () => {
  test("hashes the line hashes of the block, the same from both sides", () => {
    const a = hashed([...text("a", 3), ...shared]);
    const b = hashed([...text("b", 1), ...shared]);
    const [block] = commonBlocks(a, b, 8, sha256);
    if (!block) throw new Error("no block");
    const expected = `block:${sha256(
      a
        .slice(3, 11)
        .map((l) => l.hash)
        .join("\n"),
    )}`;
    expect(blockKey(a, block, sha256)).toBe(expected);
    const mirrored = { ...block, aStart: block.bStart, bStart: block.aStart };
    expect(blockKey(b, mirrored, sha256)).toBe(expected);
  });
});
