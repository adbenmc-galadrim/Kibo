import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBuiltinBackend, readBuiltinBackend, writeBuiltinBackend } from "./build-builtin";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("a builtin adapter builds to a CommonJS server and round-trips on disk", async () => {
  const built = await buildBuiltinBackend(
    join(import.meta.dir, "..", "..", "..", "components", "github-issues"),
  );
  expect(built.manifest).toMatchObject({ id: "github-issues", kind: "adapter" });
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function("module", "exports", built.server)(mod, mod.exports);
  const server = mod.exports.server as { actions: Record<string, unknown> };
  expect(Object.keys(server.actions).sort()).toEqual(["adapter.pull", "adapter.push"]);
  const dir = mkdtempSync(join(tmpdir(), "kibo-builtin-"));
  dirs.push(dir);
  await writeBuiltinBackend(built, join(dir, "github-issues"));
  expect(await readBuiltinBackend(join(dir, "github-issues"))).toEqual(built);
});

test("a missing prebuilt backend is a clear error", async () => {
  await expect(readBuiltinBackend(join(tmpdir(), "kibo-nope-builtin"))).rejects.toThrow("NOT_FOUND");
});
