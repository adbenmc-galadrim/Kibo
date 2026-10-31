import { join } from "node:path";
import { KiboError } from "@kibo/schema";

export type T3Runner = (
  args: readonly string[],
  opts: { cwd?: string; timeoutMs?: number },
) => Promise<{ code: number; stdout: string; stderr: string }>;

const DEFAULT_TIMEOUT_MS = 15_000;
const STDERR_EXCERPT = 300;
const COMMAND_NOT_FOUND = 127;

export function resolveT3Bin(opts: { flag?: string; env: NodeJS.ProcessEnv; home: string }): string {
  return opts.flag ?? opts.env.KIBO_T3 ?? join(opts.home, ".t3", "bin", "t3");
}

const isEnoent = (e: unknown): boolean => e instanceof Error && "code" in e && e.code === "ENOENT";

function spawnT3(bin: string, args: readonly string[], cwd: string | undefined) {
  try {
    return Bun.spawn([bin, ...args], {
      ...(cwd !== undefined && { cwd }),
      env: process.env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (e) {
    if (isEnoent(e)) throw new KiboError("T3_MISSING", `${bin} not found`);
    throw new KiboError("T3_UNAVAILABLE", `${bin} could not start: ${String(e)}`);
  }
}

export function createT3Runner(bin: string): T3Runner {
  return async (args, opts) => {
    const child = spawnT3(bin, args, opts.cwd);
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]).finally(() => clearTimeout(timer));
    if (timedOut) throw new KiboError("T3_UNAVAILABLE", `t3 timed out after ${timeoutMs} ms`);
    if (code === COMMAND_NOT_FOUND) throw new KiboError("T3_MISSING", `${bin} not found`);
    if (code !== 0) {
      throw new KiboError(
        "T3_UNAVAILABLE",
        stderr.trim().slice(0, STDERR_EXCERPT) || `t3 exited with ${code}`,
      );
    }
    return { code, stdout, stderr };
  };
}
