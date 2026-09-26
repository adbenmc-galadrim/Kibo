import { lstat, mkdir, readlink, rename, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { isCompiled } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";

type InstallOptions = {
  execPath?: string;
  binDir?: string;
  compiled?: boolean;
  env?: Record<string, string | undefined>;
};

async function lstatOrNull(path: string) {
  return lstat(path).catch((e: unknown) => {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") return null;
    throw e;
  });
}

const ephemeral = (execPath: string, env: Record<string, string | undefined>): boolean =>
  env.APPIMAGE !== undefined || execPath.includes("/AppTranslocation/");

async function replaceLink(target: string, path: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  await rm(tmp, { force: true });
  await symlink(target, tmp);
  await rename(tmp, path);
}

export async function installCli(opts: InstallOptions = {}): Promise<{ path: string }> {
  if (!(opts.compiled ?? isCompiled()))
    throw new KiboError("INVALID_INPUT", "the kibo command is installed by the desktop app");
  const execPath = opts.execPath ?? process.execPath;
  if (ephemeral(execPath, opts.env ?? process.env))
    throw new KiboError("INVALID_INPUT", "the kibo command needs Kibo installed in a stable location");
  const binDir = opts.binDir ?? join(homedir(), ".local", "bin");
  const path = join(binDir, "kibo");
  await mkdir(binDir, { recursive: true });
  const existing = await lstatOrNull(path);
  if (existing) {
    const current = existing.isSymbolicLink() ? await readlink(path) : null;
    if (current === null || basename(current) !== basename(execPath))
      throw new KiboError("CONFLICT", `${path} exists and is not a Kibo link`);
    if (current === execPath) return { path };
  }
  await replaceLink(execPath, path);
  return { path };
}
