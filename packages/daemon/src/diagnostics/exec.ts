import { existsSync } from "node:fs";
import { tryKill } from "../process-group";
import type { Exec } from "./claude-status";

function resolveBin(bin: string, env: Record<string, string | undefined>): string | null {
  if (bin.includes("/")) return existsSync(bin) ? bin : null;
  return Bun.which(bin, { PATH: env.PATH ?? "" });
}

const LAUNCH_REFUSED = new Set(["ENOENT", "EACCES"]);

const isLaunchRefused = (e: unknown): boolean =>
  e instanceof Error && "code" in e && typeof e.code === "string" && LAUNCH_REFUSED.has(e.code);

function spawnOrNull(argv: string[], env: Record<string, string | undefined>) {
  try {
    return Bun.spawn(argv, {
      env: { ...env, NO_COLOR: "1" },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (e) {
    if (isLaunchRefused(e)) return null;
    throw e;
  }
}

export function createExecPort(env: Record<string, string | undefined>): Exec {
  return async (argv, timeoutMs) => {
    const [bin, ...args] = argv;
    const resolved = bin ? resolveBin(bin, env) : null;
    const proc = resolved ? spawnOrNull([resolved, ...args], env) : null;
    if (!proc) return null;
    const timer = setTimeout(() => tryKill(`stopping ${bin}`, () => proc.kill()), timeoutMs);
    try {
      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { code, stdout, stderr };
    } finally {
      clearTimeout(timer);
    }
  };
}
