import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { KiboError, type ValidationReport } from "@kibo/schema";
import type { SourceFile } from "@kibo/trust";

const INSTALL_PREFIX = "install-";

function targetIn(dir: string, path: string): string {
  const target = resolve(dir, path);
  const rel = relative(dir, target);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new KiboError("INVALID_INPUT", `unsafe package path: ${JSON.stringify(path)}`);
  }
  return target;
}

export async function writeSources(dir: string, files: SourceFile[]): Promise<void> {
  for (const f of files) {
    const target = targetIn(dir, f.path);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, f.bytes, { mode: 0o600, flag: "wx" });
  }
}

export function validationFailures(report: ValidationReport): string {
  const errors = [
    ...report.manifest.errors,
    ...report.imports.errors,
    ...report.typecheck.errors,
    ...report.conformance.errors,
    ...report.permissions.errors,
    ...report.permissions.missing.map((p) => `missing permission ${p}`),
    ...(report.tests.ok ? [] : ["generic conformance suite failed"]),
  ];
  return errors.length > 0 ? errors.join("; ") : "validation is not green";
}

export async function withPrivateSources<T>(
  tmpRoot: string,
  files: SourceFile[],
  work: (dir: string) => Promise<T>,
): Promise<T> {
  await mkdir(tmpRoot, { recursive: true, mode: 0o700 });
  const dir = await mkdtemp(join(tmpRoot, INSTALL_PREFIX));
  try {
    await writeSources(dir, files);
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function purgeInstallDirs(tmpRoot: string): Promise<void> {
  const entries = await readdir(tmpRoot).catch((e: unknown) => {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return [];
    throw e;
  });
  for (const name of entries.filter((n) => n.startsWith(INSTALL_PREFIX))) {
    await rm(join(tmpRoot, name), { recursive: true, force: true });
  }
}
