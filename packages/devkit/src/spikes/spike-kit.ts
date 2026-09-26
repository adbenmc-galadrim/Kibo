import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const REPO = resolve(import.meta.dir, "../../../..");

export function tempDir(prefix: string): { dir: string; dispose(): void } {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

export function linkModules(dir: string): void {
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"), "dir");
}

export async function compileBinary(entrypoints: string[], outfile: string): Promise<void> {
  const result = await Bun.build({ entrypoints, compile: { outfile, autoloadPackageJson: true } });
  if (!result.success) throw new AggregateError(result.logs, "compile failed");
}
