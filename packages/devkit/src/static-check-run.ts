import { dirname } from "node:path";
import { KiboError } from "@kibo/schema";
import { type BunCommand, bunCommand } from "./bun-command";
import { FR_DEVKIT } from "./fr";
import { StaticCheck } from "./static-check";
import type { Toolchain } from "./toolchain";
import { assertNotAborted, DEFAULT_TIMEOUT_MS } from "./validate-tests";

export type StaticCheckOptions = {
  toolchain: Toolchain;
  bun?: BunCommand;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const STDERR_LIMIT = 2_000;

const timedOut = (timeoutMs: number): StaticCheck => ({
  imports: [],
  typecheck: [FR_DEVKIT.timeout(timeoutMs / 1000)],
  inference: { used: [], issues: [] },
});

function parseReport(stdout: string): StaticCheck {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
  }
  const parsed = StaticCheck.safeParse(raw);
  if (!parsed.success) throw new KiboError("INTERNAL", "static check returned an invalid report");
  return parsed.data;
}

export async function runStaticCheck(
  copy: string,
  files: string[],
  opts: StaticCheckOptions,
): Promise<StaticCheck> {
  assertNotAborted(opts.signal);
  const bun = opts.bun ?? bunCommand();
  const base = dirname(copy);
  const script = Bun.resolveSync("@kibo/devkit/static-check", opts.toolchain.root);
  const proc = Bun.spawn([...bun.argv, script, opts.toolchain.root, copy], {
    cwd: base,
    env: { ...bun.env, PATH: process.env.PATH ?? "", HOME: base, TMPDIR: base, NO_COLOR: "1" },
    stdin: new Blob([JSON.stringify(files)]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stop = () => {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill();
  };
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    stop();
  }, timeoutMs);
  opts.signal?.addEventListener("abort", stop, { once: true });
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    assertNotAborted(opts.signal);
    if (expired) return timedOut(timeoutMs);
    if (code !== 0)
      throw new KiboError("INTERNAL", `static check exited with ${code}: ${stderr.slice(-STDERR_LIMIT)}`);
    return parseReport(stdout);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", stop);
    stop();
  }
}
