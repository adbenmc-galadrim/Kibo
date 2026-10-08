import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMemory, MEMORY_FILE, saveMemory } from "./import-memory";
import { reconcile } from "./reconcile";
import { emptySnapshot, fixtureDesired } from "./reconcile.test-kit";

test("the memory round-trips through its file, absent means empty, garbage is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "import-memory-"));
  try {
    expect(loadMemory(join(dir, "absent"))).toEqual({});
    const memory = reconcile(emptySnapshot(), fixtureDesired()).memory;
    saveMemory(join(dir, "notes"), memory);
    expect(loadMemory(join(dir, "notes"))).toEqual(memory);
    writeFileSync(join(dir, "notes", MEMORY_FILE), '{"version":2}');
    expect(() => loadMemory(join(dir, "notes"))).toThrow("not an import memory");
    writeFileSync(join(dir, "notes", MEMORY_FILE), "{ tronqué");
    expect(() => loadMemory(join(dir, "notes"))).toThrow(
      expect.objectContaining({
        code: "INVALID_INPUT",
        message: expect.stringContaining("is not valid JSON"),
      }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
