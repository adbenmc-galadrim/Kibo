import { describe, expect, test } from "bun:test";
import { DEFAULT_DUPLICATION_SETTINGS, DUPLICATION_LIMITS, type WorkspaceIndex } from "@kibo/schema";
import fc from "fast-check";
import { arbIndex, arbLine, arbLines, arbSettings, fileOf, settingsWith } from "./arbitraries.test-helper";
import { commonBlocks } from "./blocks";
import { findOverlaps } from "./compare";
import { isTestPath } from "./ignore";
import { lineHashes } from "./normalize";
import { sha256 } from "./test-hash.test-helper";

const hashed = (texts: readonly string[]) =>
  lineHashes(
    texts.map((text, i) => ({ line: i + 1, text })),
    sha256,
  );

const arbShared = fc
  .array(arbLine, { minLength: 6, maxLength: 30 })
  .map((lines) => lines.map((l) => `S${l}`));

const keysOf = (a: WorkspaceIndex, b: WorkspaceIndex, settings = DEFAULT_DUPLICATION_SETTINGS) =>
  findOverlaps(a, b, settings, sha256)
    .map((c) => c.key)
    .sort();

describe("findOverlaps properties", () => {
  test("(a) lines without anything in common give no block", () => {
    fc.assert(
      fc.property(arbLines("A"), arbLines("B"), fc.integer({ min: 4, max: 50 }), (a, b, minLines) => {
        expect(commonBlocks(hashed(a), hashed(b), minLines, sha256)).toEqual([]);
      }),
    );
  });

  test("(a) every block is long enough and appears on both sides in order", () => {
    fc.assert(
      fc.property(
        arbLines("A"),
        arbLines("B"),
        arbShared,
        arbLines("C"),
        arbSettings,
        (a, b, shared, tail, s) => {
          const [la, lb] = [hashed([...a, ...shared, ...tail]), hashed([...shared, ...b, ...shared])];
          for (const block of commonBlocks(la, lb, s.minLines, sha256)) {
            expect(block.lines).toBeGreaterThanOrEqual(s.minLines);
            const ours = la.slice(block.aStart, block.aStart + block.lines).map((l) => l.hash);
            const theirs = lb.slice(block.bStart, block.bStart + block.lines).map((l) => l.hash);
            expect(theirs).toEqual(ours);
          }
          const found = findOverlaps(
            { ...emptyIndex("A"), files: [fileOf({ path: "src/a.ts", texts: [...a, ...shared, ...tail] })] },
            { ...emptyIndex("B"), files: [fileOf({ path: "src/b.ts", texts: [...shared, ...b] })] },
            settingsWith(s),
            sha256,
          );
          for (const c of found.filter((x) => x.kind === "block")) {
            expect(c.lines ?? 0).toBeGreaterThanOrEqual(s.minLines);
            expect(c.chars ?? 0).toBeGreaterThanOrEqual(DUPLICATION_LIMITS.blockMinChars);
          }
        },
      ),
    );
  });

  test("(b) swapping the sides gives the same keys", () => {
    fc.assert(
      fc.property(
        arbShared.chain((shared) => fc.tuple(arbIndex("A", shared), arbIndex("B", shared))),
        arbSettings,
        ([a, b], s) => {
          expect(keysOf(b, a, settingsWith(s))).toEqual(keysOf(a, b, settingsWith(s)));
        },
      ),
    );
  });

  test("(d) an identical file at the same path never yields a candidate", () => {
    fc.assert(
      fc.property(
        arbShared.chain((shared) =>
          fc.tuple(arbIndex("A", shared), arbIndex("B", shared), fc.constant(shared)),
        ),
        ([a, b, shared]) => {
          const copy = fileOf({ path: "src/copy.ts", texts: [...shared, "export const formatCopy = 1;"] });
          const found = findOverlaps(
            { ...a, files: [...a.files, copy] },
            { ...b, files: [...b.files, copy] },
            DEFAULT_DUPLICATION_SETTINGS,
            sha256,
          );
          for (const c of found) {
            expect([c.a.path, c.b.path]).not.toContain("src/copy.ts");
            expect(c.name).not.toBe("formatCopy");
          }
        },
      ),
    );
  });

  test("(d) tests, short names and generic names never yield a candidate by default", () => {
    fc.assert(
      fc.property(
        arbShared.chain((shared) => fc.tuple(arbIndex("A", shared), arbIndex("B", shared))),
        ([a, b]) => {
          for (const c of findOverlaps(a, b, DEFAULT_DUPLICATION_SETTINGS, sha256)) {
            expect(isTestPath(c.a.path) || isTestPath(c.b.path)).toBe(false);
            if (c.name === null) continue;
            expect(c.name.length).toBeGreaterThanOrEqual(DUPLICATION_LIMITS.exportNameMin);
            expect(DEFAULT_DUPLICATION_SETTINGS.genericExports).not.toContain(c.name);
          }
        },
      ),
    );
  });
});

function emptyIndex(key: string): WorkspaceIndex {
  return { key, runIds: [], baseHead: "base", files: [], truncated: false, partial: false, at: 0 };
}
