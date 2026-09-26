import { lstat, mkdir, readlink, rename, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { isCompiled } from "@kibo/devkit";
import { KiboError } from "@kibo/schema";

type InstallOptions = {
  execPath?: string;
  binDir?: string;
  compiled?: boolean;
  env?: Record<string, string | undefined>;
};

const DENIED = ["EACCES", "EPERM", "EROFS", "ENOTDIR"];

const errnoOf = (e: unknown): unknown => (e instanceof Error && "code" in e ? e.code : undefined);

async function lstatOrNull(path: string) {
  return lstat(path).catch((e: unknown) => {
    if (errnoOf(e) === "ENOENT") return null;
    throw e;
  });
}

function permissionDenied(path: string) {
  return (e: unknown): never => {
    const code = errnoOf(e);
    if (typeof code === "string" && DENIED.includes(code))
      throw new KiboError("PERMISSION_DENIED", `${path} is not writable (${code})`);
    throw e;
  };
}

const commandPath = (binDir: string | undefined): string =>
  join(binDir ?? join(homedir(), ".local", "bin"), "kibo");

const ephemeral = (execPath: string, env: Record<string, string | undefined>): boolean =>
  env.APPIMAGE !== undefined || execPath.includes("/AppTranslocation/");

async function replaceLink(target: string, path: string): Promise<void> {
  const tmp = `${path}.${process.pid}.tmp`;
  await rm(tmp, { force: true });
  await symlink(target, tmp);
  await rename(tmp, path);
}

export async function cliStatus(opts: InstallOptions = {}): Promise<{ path: string; installed: boolean }> {
  const path = commandPath(opts.binDir);
  const existing = await lstatOrNull(path);
  const target = existing?.isSymbolicLink() ? await readlink(path) : null;
  return { path, installed: target === (opts.execPath ?? process.execPath) };
}

async function link(execPath: string, binDir: string, path: string): Promise<void> {
  await mkdir(binDir, { recursive: true });
  const existing = await lstatOrNull(path);
  if (existing) {
    const current = existing.isSymbolicLink() ? await readlink(path) : null;
    if (current === null || basename(current) !== basename(execPath))
      throw new KiboError("CONFLICT", `${path} exists and is not a Kibo link`);
    if (current === execPath) return;
  }
  await replaceLink(execPath, path);
}

export async function installCli(opts: InstallOptions = {}): Promise<{ path: string }> {
  if (!(opts.compiled ?? isCompiled()))
    throw new KiboError("INVALID_INPUT", "the kibo command is installed by the desktop app");
  const execPath = opts.execPath ?? process.execPath;
  if (ephemeral(execPath, opts.env ?? process.env))
    throw new KiboError("INVALID_INPUT", "the kibo command needs Kibo installed in a stable location");
  const path = commandPath(opts.binDir);
  await link(execPath, dirname(path), path).catch(permissionDenied(path));
  return { path };
}
