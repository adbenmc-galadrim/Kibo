import { KiboError } from "@kibo/schema";
import { utf8 } from "./bytes";

export type SourceFile = { path: string; bytes: Uint8Array };

const MANIFEST = "kibo.component.json";
const SKIPPED = new Set(["node_modules", "dist"]);
const HASHED = /\.(ts|tsx|css)$/;
const TEST = /\.test\.tsx?$/;

const comparePaths = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function isSafePath(path: string): boolean {
  if (path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function assertSafePaths(files: SourceFile[]): void {
  const seen = new Set<string>();
  for (const { path } of files) {
    if (!isSafePath(path))
      throw new KiboError("INVALID_INPUT", `unsafe source path: ${JSON.stringify(path)}`);
    if (seen.has(path)) throw new KiboError("INVALID_INPUT", `duplicate source path: ${path}`);
    seen.add(path);
  }
}

export function isHashedSource(path: string): boolean {
  if (!isSafePath(path)) return false;
  if (path.split("/").some((p) => p.startsWith(".") || SKIPPED.has(p))) return false;
  return path === MANIFEST || (HASHED.test(path) && !TEST.test(path));
}

export function sourceHash(files: SourceFile[]): string {
  assertSafePaths(files);
  const hasher = new Bun.CryptoHasher("sha256");
  const kept = files.filter((f) => isHashedSource(f.path)).sort((a, b) => comparePaths(a.path, b.path));
  for (const f of kept) {
    hasher.update(utf8(`${f.path}\0${f.bytes.byteLength}\0`));
    hasher.update(f.bytes);
  }
  return hasher.digest("hex");
}
