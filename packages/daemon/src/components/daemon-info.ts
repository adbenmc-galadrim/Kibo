import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { z } from "zod";

const Port = z.number().int().min(0).max(65_535);
const DaemonInfo = z.object({ port: Port, sandboxPort: Port, pid: z.number().int().positive() });
export type DaemonInfo = z.infer<typeof DaemonInfo>;

const fileOf = (home: string) => join(home, "daemon.json");

export function writeDaemonInfo(home: string, info: DaemonInfo): void {
  writeFileSync(fileOf(home), JSON.stringify(DaemonInfo.parse(info)), { mode: 0o600 });
  chmodSync(fileOf(home), 0o600);
}

export function readDaemonInfo(home: string): DaemonInfo | null {
  if (!existsSync(fileOf(home))) return null;
  const parsed = DaemonInfo.safeParse(JSON.parse(readFileSync(fileOf(home), "utf8")));
  return parsed.success ? parsed.data : null;
}

export function removeDaemonInfo(home: string): void {
  rmSync(fileOf(home), { force: true });
}

const defaultSandboxPort = (port: number) => (port === 0 ? 0 : port + 1);
const portOf = (text: string) => (/^\d+$/.test(text) ? Number(text) : Number.NaN);

export function sandboxPortFor(port: number, explicit: string | undefined): number {
  const chosen = explicit === undefined ? defaultSandboxPort(port) : portOf(explicit);
  const parsed = Port.safeParse(chosen);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid sandbox port: ${explicit ?? chosen}`);
  return parsed.data;
}
