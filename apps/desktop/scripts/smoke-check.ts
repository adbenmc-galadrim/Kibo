import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function recordedPid(home: string): number | null {
  const file = join(home, "daemon.json");
  if (!existsSync(file)) return null;
  try {
    const pid: unknown = Reflect.get(JSON.parse(readFileSync(file, "utf8")), "pid");
    return typeof pid === "number" ? pid : null;
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ESRCH") return false;
    throw e;
  }
}

export function smokeCommand(binary: string, platform: NodeJS.Platform): string[] {
  return platform === "linux" ? ["xvfb-run", "-a", binary] : [binary];
}
