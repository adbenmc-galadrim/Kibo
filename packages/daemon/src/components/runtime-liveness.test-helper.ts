import { existsSync, readdirSync, readlinkSync } from "node:fs";

export type RuntimeSelf = { pid: number; cwd: string };

export function runtimeSelf(value: unknown): RuntimeSelf {
  if (typeof value !== "object" || value === null) throw new Error("the runtime did not describe itself");
  const pid = "pid" in value ? value.pid : null;
  const cwd = "cwd" in value ? value.cwd : null;
  if (typeof pid !== "number" || typeof cwd !== "string")
    throw new Error("the runtime did not describe itself");
  return { pid, cwd };
}

const hasCode = (e: unknown, codes: string[]) =>
  e instanceof Error && "code" in e && typeof e.code === "string" && codes.includes(e.code);

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (hasCode(e, ["ESRCH"])) return false;
    throw e;
  }
}

function cwdOf(pid: string): string | null {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch (e) {
    if (hasCode(e, ["ENOENT", "ESRCH", "EACCES"])) return null;
    throw e;
  }
}

function anyProcessIn(dir: string): boolean {
  return readdirSync("/proc")
    .filter((entry) => /^\d+$/.test(entry))
    .some((pid) => cwdOf(pid)?.startsWith(dir) ?? false);
}

export function runtimeAlive(self: RuntimeSelf): boolean {
  if (existsSync(self.cwd)) return true;
  return process.platform === "linux" ? anyProcessIn(self.cwd) : pidAlive(self.pid);
}

export async function runtimeGone(self: RuntimeSelf): Promise<boolean> {
  for (let i = 0; i < 100; i += 1) {
    if (!runtimeAlive(self)) return true;
    await Bun.sleep(20);
  }
  return false;
}
