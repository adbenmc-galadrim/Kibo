import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { exportsOf, type ImportProbe, resolveRelative } from "@kibo/core";
import { DUPLICATION_LIMITS, type WorkspaceIndex } from "@kibo/schema";
import { isInside } from "../code/safe-path";

export type ProbeStat = { size: number; mtimeMs: number; file: boolean };
export type ProbeFs = {
  lstat(path: string): ProbeStat | null;
  realpath(path: string): string | null;
  read(path: string, max: number): Buffer | null;
};

const BINARY_SNIFF_BYTES = 8_192;

const orNull = <T>(fn: () => T): T | null => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export const nodeProbeFs: ProbeFs = {
  lstat: (path) =>
    orNull(() => {
      const s = lstatSync(path, { throwIfNoEntry: false });
      return s ? { size: s.size, mtimeMs: s.mtimeMs, file: s.isFile() } : null;
    }),
  realpath: (path) => orNull(() => realpathSync(path)),
  read: (path, max) =>
    orNull(() => {
      const bytes = readFileSync(path);
      return bytes.length > max ? null : bytes;
    }),
};

type Module = { exports: string[] } | null;

const isBinary = (bytes: Buffer): boolean => bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);

export function createImportProbes(deps: { fs?: ProbeFs } = {}) {
  const fs = deps.fs ?? nodeProbeFs;
  const modules = new Map<string, { stamp: string; module: Module }>();

  const remember = (path: string, stamp: string, module: Module): Module => {
    modules.delete(path);
    modules.set(path, { stamp, module });
    const oldest = modules.keys().next().value;
    if (modules.size > DUPLICATION_LIMITS.cacheFiles && oldest !== undefined) modules.delete(oldest);
    return module;
  };

  const moduleAt = (path: string, stat: ProbeStat): Module => {
    const stamp = `${stat.size}:${stat.mtimeMs}`;
    const known = modules.get(path);
    if (known?.stamp === stamp) return known.module;
    const bytes =
      stat.size > DUPLICATION_LIMITS.fileBytes ? null : fs.read(path, DUPLICATION_LIMITS.fileBytes);
    const module =
      bytes === null || isBinary(bytes)
        ? null
        : { exports: exportsOf(bytes.toString("utf8").split("\n"), []) };
    return remember(path, stamp, module);
  };

  const probe =
    (index: WorkspaceIndex): ImportProbe =>
    (fromPath, spec) => {
      const inside = (rel: string): boolean => {
        const full = join(index.key, rel);
        if (!fs.lstat(full)?.file) return false;
        const real = fs.realpath(full);
        return real !== null && isInside(index.key, real);
      };
      const path = resolveRelative(fromPath, spec, inside);
      if (path === null) return null;
      const full = join(index.key, path);
      const stat = fs.lstat(full);
      const module = stat ? moduleAt(full, stat) : null;
      if (module === null) return null;
      const added = index.files.some((f) => f.path === path && f.status === "added");
      return { path, added, exports: module.exports };
    };

  return { probe };
}
