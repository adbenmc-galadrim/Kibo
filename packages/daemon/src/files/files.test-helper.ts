import { afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const GLB = Uint8Array.from([...Buffer.from("glTF"), 2, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
export const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

export function folder() {
  const root = mkdtempSync(join(tmpdir(), "kibo-files-"));
  roots.push(root);
  const dir = join(root, "files");
  mkdirSync(dir);
  writeFileSync(join(root, "secret.md"), "secret");
  return { root, dir };
}
