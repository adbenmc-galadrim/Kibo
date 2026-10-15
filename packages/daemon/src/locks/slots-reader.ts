import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type LockTicket, type MachineLock, maskSecretsWithin } from "@kibo/schema";
import { z } from "zod";

export type SlotsIo = {
  dir: string;
  exists(path: string): boolean;
  readdir(path: string): string[];
  readFile(path: string): string;
  alive(pid: number): boolean;
};

const LABEL_MAX = 200;
const CWD_MAX = 500;

const TicketFile = z.object({
  pid: z.number().int().positive(),
  since: z.number().nonnegative(),
  label: z.string(),
  cwd: z.string(),
  ticket: z.string().min(1).max(200),
});

const warn = (what: string, error: unknown) =>
  console.error(
    `[kibo-daemon] ignoring delivery slot ${what}`,
    error instanceof Error ? error.message : error,
  );

function attempt<T>(what: string, read: () => T): T | null {
  try {
    return read();
  } catch (e) {
    warn(what, e);
    return null;
  }
}

function readTicket(io: SlotsIo, path: string): LockTicket | null {
  const parsed = attempt(path, () => TicketFile.parse(JSON.parse(io.readFile(path))));
  if (parsed === null) return null;
  return {
    ticket: parsed.ticket,
    label: maskSecretsWithin(parsed.label, LABEL_MAX),
    pid: parsed.pid,
    since: Math.round(parsed.since * 1000),
    cwd: maskSecretsWithin(parsed.cwd, CWD_MAX),
    alive: io.alive(parsed.pid),
  };
}

function readTickets(io: SlotsIo, dir: string): LockTicket[] {
  if (!io.exists(dir)) return [];
  const names = attempt(dir, () => io.readdir(dir)) ?? [];
  return names
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => readTicket(io, join(dir, name)) ?? []);
}

function readMax(io: SlotsIo, dir: string): number | null {
  const path = join(dir, "max");
  if (!io.exists(path)) return null;
  const raw = attempt(path, () => io.readFile(path).trim());
  if (raw === null || !/^\d+$/.test(raw)) {
    if (raw !== null) warn(path, `invalid max ${JSON.stringify(raw)}`);
    return null;
  }
  return Number(raw);
}

function readLock(io: SlotsIo, name: string): MachineLock | null {
  const dir = join(io.dir, name);
  const max = readMax(io, dir);
  if (max === null) return null;
  return {
    name,
    max,
    held: readTickets(io, join(dir, "held")),
    waiting: readTickets(io, join(dir, "wait")),
  };
}

export function readMachineLocks(io: SlotsIo): MachineLock[] {
  if (!io.exists(io.dir)) return [];
  const names = attempt(io.dir, () => io.readdir(io.dir)) ?? [];
  return names.sort().flatMap((name) => readLock(io, name) ?? []);
}

export const slotsDirOf = (env: Record<string, string | undefined>, home: string): string =>
  env.DELIVERY_SLOTS ?? join(home, ".delivery", "slots");

export const slotsLabelOf = (dir: string, home: string): string =>
  dir === home || dir.startsWith(`${home}/`) ? `~${dir.slice(home.length)}` : "$DELIVERY_SLOTS";

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e instanceof Error && "code" in e && e.code === "EPERM";
  }
}

export const readSlotsDir = (dir: string, deps: { alive(pid: number): boolean }): MachineLock[] =>
  readMachineLocks({
    dir,
    exists: existsSync,
    readdir: (path) => readdirSync(path),
    readFile: (path) => readFileSync(path, "utf8"),
    alive: deps.alive,
  });
