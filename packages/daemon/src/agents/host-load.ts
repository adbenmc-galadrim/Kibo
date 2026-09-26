import { readFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { type HostInfo, type HostLoad, KiboError } from "@kibo/schema";

export type LoadDeps = {
  platform: NodeJS.Platform;
  cpuTimes: () => { idle: number; total: number };
  memoryPressure: () => string;
  meminfo: () => string;
};

function cpuTimes(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const { times } of cpus()) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

function memoryPressure(): string {
  const result = Bun.spawnSync(["/usr/bin/memory_pressure", "-Q"]);
  if (!result.success) {
    throw new KiboError(
      "INTERNAL",
      `memory_pressure exited with ${result.exitCode}: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString();
}

const defaults = (): LoadDeps => ({
  platform: process.platform,
  cpuTimes,
  memoryPressure,
  meminfo: () => readFileSync("/proc/meminfo", "utf8"),
});

export function parseMemoryPressure(text: string): number {
  const free = /free percentage:\s*(\d+)%/.exec(text)?.[1];
  if (free === undefined) throw new KiboError("INTERNAL", "cannot read memory_pressure output");
  return 100 - Number(free);
}

function meminfoField(text: string, name: string): number | undefined {
  const value = new RegExp(`^${name}:\\s*(\\d+)`, "m").exec(text)?.[1];
  return value === undefined ? undefined : Number(value);
}

export function parseMeminfo(text: string): number {
  const total = meminfoField(text, "MemTotal");
  const available = meminfoField(text, "MemAvailable");
  if (!total || available === undefined) throw new KiboError("INTERNAL", "cannot read /proc/meminfo");
  return Math.round(((total - available) / total) * 100);
}

export function createLoadSampler(deps: LoadDeps = defaults()): () => HostLoad {
  let previous = deps.cpuTimes();
  return () => {
    const now = deps.cpuTimes();
    const total = now.total - previous.total;
    const idle = now.idle - previous.idle;
    previous = now;
    const cpu = total > 0 ? Math.round(((total - idle) / total) * 100) : 0;
    const ram =
      deps.platform === "darwin" ? parseMemoryPressure(deps.memoryPressure()) : parseMeminfo(deps.meminfo());
    return { cpu, ram };
  };
}

export function readHostInfo(): HostInfo {
  return { cores: cpus().length, ramGb: Math.round(totalmem() / 1024 ** 3) };
}
