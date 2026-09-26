import { cpSync, mkdtempSync, readdirSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const REPO = resolve(import.meta.dir, "../../..");
export const DEV_TOOLCHAIN = { root: REPO };

function unsuffix(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) unsuffix(path);
    else if (entry.name.endsWith(".fixture")) renameSync(path, path.slice(0, -".fixture".length));
  }
}

export function copyFixture(
  name: string,
  opts: { linkModules?: boolean; from?: string } = {},
): { dir: string; dispose(): void } {
  const base = mkdtempSync(join(tmpdir(), "kibo-fixture-"));
  const dir = join(base, name);
  cpSync(join(opts.from ?? join(REPO, "packages/devkit/fixtures"), name), dir, { recursive: true });
  unsuffix(dir);
  if (opts.linkModules ?? true) symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"), "dir");
  return { dir, dispose: () => rmSync(base, { recursive: true, force: true }) };
}
