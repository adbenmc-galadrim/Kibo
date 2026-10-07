import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HASH_FILE, writeNotes } from "./notes";

const NOTE = {
  path: "briefs/C0-2.md",
  content:
    "---\nsource: tmp/briefs/C0-2.md\nimported: 2026-10-06\ntickets: [plan:C0-2, plan:C9-9]\n---\n\n# Brief\n",
};
const KEYS = new Map([["plan:C0-2", "EMIS-2"]]);
const WRITTEN = NOTE.content.replace("plan:C0-2", "EMIS-2");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const hashes = (dir: string): unknown => JSON.parse(readFileSync(join(dir, HASH_FILE), "utf8"));

test("notes are written with ticket keys and their hash, then kept", () => {
  const dir = mkdtempSync(join(tmpdir(), "import-emis-notes-"));
  expect(writeNotes(dir, [NOTE], KEYS)).toEqual([
    { kind: "created", what: "note briefs/C0-2.md", detail: "" },
  ]);
  expect(readFileSync(join(dir, NOTE.path), "utf8")).toBe(WRITTEN);
  expect(hashes(dir)).toEqual({ "briefs/C0-2.md": sha(WRITTEN) });
  expect(writeNotes(dir, [NOTE], KEYS).map((c) => c.kind)).toEqual(["kept"]);
  const changed = { ...NOTE, content: NOTE.content.replace("# Brief", "# Brief v2") };
  expect(writeNotes(dir, [changed], KEYS).map((c) => c.kind)).toEqual(["updated"]);
  expect(readFileSync(join(dir, NOTE.path), "utf8")).toContain("# Brief v2");
});

test("a note edited by hand is drift and is not overwritten", () => {
  const dir = mkdtempSync(join(tmpdir(), "import-emis-notes-"));
  writeNotes(dir, [NOTE], KEYS);
  writeFileSync(join(dir, NOTE.path), "# Mes notes\n");
  expect(writeNotes(dir, [NOTE], KEYS)).toEqual([
    { kind: "drift", what: "note briefs/C0-2.md", detail: "edited since the last import" },
  ]);
  expect(readFileSync(join(dir, NOTE.path), "utf8")).toBe("# Mes notes\n");
});

test("a note already identical gets its hash; an unknown different file is drift", () => {
  const dir = mkdtempSync(join(tmpdir(), "import-emis-notes-"));
  writeNotes(dir, [NOTE], KEYS);
  rmSync(join(dir, HASH_FILE));
  expect(writeNotes(dir, [NOTE], KEYS).map((c) => c.kind)).toEqual(["kept"]);
  expect(hashes(dir)).toEqual({ "briefs/C0-2.md": sha(WRITTEN) });
  rmSync(join(dir, HASH_FILE));
  writeFileSync(join(dir, NOTE.path), "autre\n");
  expect(writeNotes(dir, [NOTE], KEYS).map((c) => c.kind)).toEqual(["drift"]);
});

test("a dry run writes nothing and a path outside the folder is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "import-emis-notes-"));
  expect(writeNotes(dir, [NOTE], KEYS, { dryRun: true }).map((c) => c.kind)).toEqual(["created"]);
  expect(existsSync(join(dir, NOTE.path))).toBe(false);
  expect(existsSync(join(dir, HASH_FILE))).toBe(false);
  expect(() => writeNotes(dir, [{ path: "../evil.md", content: "x" }], KEYS)).toThrow(/outside/);
});
