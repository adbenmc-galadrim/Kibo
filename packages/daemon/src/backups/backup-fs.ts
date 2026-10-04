import { existsSync } from "node:fs";
import { chmod, cp, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BackupId, BackupInfo, type BackupReason, KiboError } from "@kibo/schema";

export const BACKUP_COPIED = ["components", "notes"] as const;
export const BACKUP_EXCLUDED = [
  "token",
  "daemon.json",
  "mcp",
  "remote",
  "tmp",
  "runs",
  "bin",
  "files",
  "backups",
  "demo-agent",
] as const;
export type BackupDatabase = { file: string; vacuumInto(path: string): void };
export type WriteBackupInput = {
  home: string;
  dest: string;
  id: string;
  reason: BackupReason;
  appVersion: string;
  now: number;
  databases: BackupDatabase[];
};

type Manifest = BackupInfo & { entries: string[] };

const PARTIAL = ".partial";

async function purgePartials(dest: string): Promise<void> {
  if (!existsSync(dest)) return;
  for (const name of await readdir(dest))
    if (name.endsWith(PARTIAL)) await rm(join(dest, name), { recursive: true, force: true });
}

function assertId(id: string): void {
  if (!BackupId.safeParse(id).success) throw new KiboError("INVALID_INPUT", `${id} is not a backup id`);
}

async function sizeOf(path: string): Promise<number> {
  const s = await lstat(path);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const child of await readdir(path)) total += await sizeOf(join(path, child));
  return total;
}

async function fillStaging(staging: string, input: WriteBackupInput): Promise<Manifest> {
  const entries: string[] = [];
  for (const db of input.databases) {
    const target = join(staging, db.file);
    db.vacuumInto(target);
    await chmod(target, 0o600);
    entries.push(db.file);
  }
  for (const name of BACKUP_COPIED) {
    const source = join(input.home, name);
    if (!existsSync(source)) continue;
    await cp(source, join(staging, name), { recursive: true, dereference: false, verbatimSymlinks: true });
    entries.push(name);
  }
  const bytes = await sizeOf(staging);
  const manifest: Manifest = {
    id: input.id,
    createdAt: input.now,
    reason: input.reason,
    bytes,
    appVersion: input.appVersion,
    entries,
  };
  await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return manifest;
}

export async function writeBackup(input: WriteBackupInput): Promise<BackupInfo> {
  assertId(input.id);
  const final = join(input.dest, input.id);
  if (existsSync(final)) throw new KiboError("CONFLICT", `backup ${input.id} already exists`);
  const staging = `${final}${PARTIAL}`;
  await purgePartials(input.dest);
  await mkdir(staging, { recursive: true, mode: 0o700 });
  await chmod(staging, 0o700);
  try {
    const { entries: _entries, ...info } = await fillStaging(staging, input);
    await rename(staging, final);
    return info;
  } catch (e) {
    await rm(staging, { recursive: true, force: true });
    throw e;
  }
}

async function readManifest(dest: string, name: string): Promise<BackupInfo | null> {
  const file = join(dest, name, "manifest.json");
  try {
    const info = BackupInfo.safeParse(JSON.parse(await readFile(file, "utf8")));
    if (info.success && info.data.id === name) return info.data;
    console.warn(`[kibo-daemon] backup ${name} has an invalid manifest`);
  } catch (e) {
    console.warn(`[kibo-daemon] backup ${name} has no readable manifest`, e);
  }
  return null;
}

export async function readBackups(dest: string): Promise<BackupInfo[]> {
  if (!existsSync(dest)) return [];
  const out: BackupInfo[] = [];
  for (const name of await readdir(dest)) {
    if (!BackupId.safeParse(name).success) continue;
    const info = await readManifest(dest, name);
    if (info) out.push(info);
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeBackupDir(dest: string, id: string): Promise<void> {
  assertId(id);
  await rm(join(dest, id), { recursive: true, force: true });
}
