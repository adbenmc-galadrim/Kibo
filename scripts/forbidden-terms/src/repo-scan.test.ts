import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatHits, scanRepo } from "./repo-scan";

const terms = ["tolo", "zoé"];

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "kibo-repo-scan-"));
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  };
  git("init", "-q");
  mkdirSync(join(root, "e2e"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "e2e", "clean.ts"), "rien\n");
  writeFileSync(join(root, "e2e", "seed.ts"), "a\nTolo\n");
  writeFileSync(join(root, "e2e", "tolo-gh.ts"), "rien\n");
  writeFileSync(join(root, "docs", "image.png"), Buffer.from([0x89, 0, 0x74, 0x6f, 0x6c, 0x6f]));
  writeFileSync(join(root, "docs", "zoé.png"), Buffer.from([0x89, 0]));
  writeFileSync(join(root, "untracked.ts"), "tolo\n");
  git("add", "e2e", "docs");
  return root;
}

test("scanRepo finds terms in tracked contents and names, never in binaries", () => {
  expect(scanRepo(fixtureRepo(), terms, [])).toEqual([
    { path: "docs/zoé.png", line: null, term: 2 },
    { path: "e2e/seed.ts", line: 2, term: 1 },
    { path: "e2e/tolo-gh.ts", line: null, term: 1 },
  ]);
});

test("scanRepo honours the scope", () => {
  expect(scanRepo(fixtureRepo(), terms, ["docs"])).toEqual([{ path: "docs/zoé.png", line: null, term: 2 }]);
});

test("scanRepo skips a tracked file deleted from the working tree", () => {
  const root = fixtureRepo();
  rmSync(join(root, "e2e", "seed.ts"));
  expect(scanRepo(root, terms, ["e2e/seed.ts"])).toEqual([]);
});

test("formatHits prints positions and term numbers, masking terms in paths", () => {
  const text = formatHits(
    [
      { path: "e2e/seed.ts", line: 2, term: 1 },
      { path: "e2e/Tolo-gh/zoé.ts", line: null, term: 1 },
    ],
    terms,
    50,
  );
  expect(text).toBe("2 hits\ne2e/seed.ts:2 terme 1\ne2e/<terme 1>-gh/<terme 2>.ts:nom terme 1");
});

test("formatHits truncates after the limit", () => {
  const hits = [1, 2, 3].map((line) => ({ path: "a.ts", line, term: 1 }));
  expect(formatHits(hits, terms, 2)).toBe("3 hits\na.ts:1 terme 1\na.ts:2 terme 1\n… et 1 autres");
});
