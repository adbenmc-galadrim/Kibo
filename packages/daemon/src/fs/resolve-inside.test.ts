import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveInside } from "./resolve-inside";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
function folder() {
  const root = mkdtempSync(join(tmpdir(), "kibo-inside-"));
  roots.push(root);
  const dir = join(root, "files");
  mkdirSync(dir);
  writeFileSync(join(root, "secret.md"), "secret");
  return { root, dir };
}

test("a plain relative path resolves under the real folder", async () => {
  const { dir } = folder();
  expect(await resolveInside(dir, "a/b.png")).toBe(join(realpathSync(dir), "a", "b.png"));
});

test("traversal, symbolic links and absolute paths are refused", async () => {
  const { root, dir } = folder();
  symlinkSync(join(root, "secret.md"), join(dir, "evil.md"));
  symlinkSync(root, join(dir, "linked"));
  for (const p of [
    "../secret.md",
    "a/../../secret.md",
    "/etc/passwd.md",
    "evil.md",
    "linked/secret.md",
    "",
    ".",
  ]) {
    await expect(resolveInside(dir, p)).rejects.toThrow("PATH_OUTSIDE_PROJECT");
  }
});

test("the label names the refused path", async () => {
  const { dir } = folder();
  await expect(resolveInside(dir, "../x.glb", "project file")).rejects.toThrow("project file ../x.glb");
});
