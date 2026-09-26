import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isCompiled } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";

type InstallOptions = { execPath?: string; binDir?: string; compiled?: boolean };

async function lstatOrNull(path: string) {
  return lstat(path).catch((e: unknown) => {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
    throw e;
  });
}

export async function installCli(opts: InstallOptions = {}): Promise<{ path: string }> {
  if (!(opts.compiled ?? isCompiled()))
    throw new KiboError("INVALID_INPUT", "the kibo command is installed by the desktop app");
  const execPath = opts.execPath ?? process.execPath;
  const binDir = opts.binDir ?? join(homedir(), ".local", "bin");
  const path = join(binDir, "kibo");
  await mkdir(binDir, { recursive: true });
  const existing = await lstatOrNull(path);
  if (existing) {
    if (!existing.isSymbolicLink()) throw new KiboError("CONFLICT", `${path} exists and is not a Kibo link`);
    if ((await readlink(path)) === execPath) return { path };
    await rm(path);
  }
  await symlink(execPath, path);
  return { path };
}
