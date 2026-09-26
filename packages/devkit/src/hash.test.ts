import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashSources, isHashed, listSourceFiles, readSources } from "./hash";

function dir(files: [string, string][]): string {
  const d = mkdtempSync(join(tmpdir(), "kibo-hash-"));
  for (const [path, text] of files) {
    mkdirSync(join(d, path, ".."), { recursive: true });
    writeFileSync(join(d, path), text);
  }
  return d;
}

const MANIFEST: [string, string] = ["kibo.component.json", '{"id":"x"}'];

describe("hash", () => {
  test("the hash does not depend on the order files were written", async () => {
    const a = dir([MANIFEST, ["ui.tsx", "a"], ["lib/b.ts", "b"]]);
    const b = dir([["lib/b.ts", "b"], ["ui.tsx", "a"], MANIFEST]);
    expect(await hashSources(a)).toBe(await hashSources(b));
  });
  test("one changed byte, including a line ending, changes the hash", async () => {
    const base = await hashSources(dir([MANIFEST, ["ui.tsx", "a\n"]]));
    expect(await hashSources(dir([MANIFEST, ["ui.tsx", "b\n"]]))).not.toBe(base);
    expect(await hashSources(dir([MANIFEST, ["ui.tsx", "a\r\n"]]))).not.toBe(base);
  });
  test("tests, hidden files, node_modules, dist and other extensions are not hashed", async () => {
    const base = await hashSources(dir([MANIFEST, ["ui.tsx", "a"]]));
    const noisy = dir([
      MANIFEST,
      ["ui.tsx", "a"],
      ["component.test.tsx", "t"],
      ["x.test.ts", "t"],
      [".kibo/validation.json", "{}"],
      ["dist/ui.js", "x"],
      ["README.md", "r"],
    ]);
    expect(await hashSources(noisy)).toBe(base);
    expect(await listSourceFiles(noisy)).toEqual([
      "README.md",
      "component.test.tsx",
      "kibo.component.json",
      "ui.tsx",
      "x.test.ts",
    ]);
    expect(isHashed("styles/a.css")).toBe(true);
  });
  test("a symbolic link or a missing manifest fails validation", async () => {
    const withLink = dir([MANIFEST, ["ui.tsx", "a"]]);
    symlinkSync("/etc/hosts", join(withLink, "evil.ts"));
    await expect(readSources(withLink)).rejects.toThrow("VALIDATION_FAILED");
    await expect(readSources(dir([["ui.tsx", "a"]]))).rejects.toThrow("VALIDATION_FAILED");
  });
});
