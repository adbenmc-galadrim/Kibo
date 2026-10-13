import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { DUPLICATION_LIMITS, KiboError } from "@kibo/schema";
import { resolveInWorktree } from "../code/safe-path";

export type PeekFs = {
  stat(path: string): Promise<{ size: number; mtimeMs: number } | null>;
  read(path: string, max: number): Promise<Buffer | null>;
};
export type PathScreen = (path: string) => "secret" | "ignored" | null;

const BINARY_PROBE_BYTES = 8_192;
const SCREEN_REASON = { secret: "fichier secret", ignored: "fichier ignoré" } as const;

const refuse = (path: string, reason: string) => new KiboError("INVALID_INPUT", `${path} : ${reason}`);

function isLink(root: string, relPath: string): boolean {
  if (isAbsolute(relPath) || relPath.includes("\0")) return false;
  return (
    lstatSync(resolve(realpathSync(root), relPath), { throwIfNoEntry: false })?.isSymbolicLink() ?? false
  );
}

function insideOrRefuse(root: string, relPath: string): string {
  try {
    return resolveInWorktree(root, relPath);
  } catch (e) {
    if (!(e instanceof KiboError) || e.code !== "PATH_OUTSIDE_PROJECT") throw e;
    throw refuse(relPath, isLink(root, relPath) ? "lien symbolique" : "chemin hors de l'espace de travail");
  }
}

export function resolvePeekPath(root: string, relPath: string, screen: PathScreen): string {
  const abs = insideOrRefuse(root, relPath);
  if (lstatSync(abs, { throwIfNoEntry: false })?.isSymbolicLink()) throw refuse(relPath, "lien symbolique");
  const screened = screen(relPath);
  if (screened !== null) throw refuse(relPath, SCREEN_REASON[screened]);
  return abs;
}

export async function readPeekFile(fs: PeekFs, abs: string, relPath: string): Promise<string | null> {
  const max = DUPLICATION_LIMITS.peekContentBytes;
  const stat = await fs.stat(abs);
  if (stat === null) return null;
  if (stat.size > max) throw refuse(relPath, "fichier trop grand");
  const bytes = await fs.read(abs, max + 1);
  if (bytes === null) return null;
  if (bytes.length > max) throw refuse(relPath, "fichier trop grand");
  if (bytes.subarray(0, BINARY_PROBE_BYTES).includes(0)) throw refuse(relPath, "fichier binaire");
  return bytes.toString("utf8");
}
