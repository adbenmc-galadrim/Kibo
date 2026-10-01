import { dirname } from "node:path";
import { KiboError } from "@kibo/schema";
import { type BunCommand, bunCommand } from "./bun-command";
import { StaticCheck } from "./static-check";
import type { Toolchain } from "./toolchain";
import { assertNotAborted } from "./validate-tests";

export type StaticCheckOptions = { toolchain: Toolchain; bun?: BunCommand; signal?: AbortSignal };

const STDERR_LIMIT = 2_000;

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
    cwd: copy,
    env: { ...bun.env, PATH: process.env.PATH ?? "", HOME: base, TMPDIR: base, NO_COLOR: "1" },
    stdin: new Blob([JSON.stringify(files)]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stop = () => {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill();
  };
  opts.signal?.addEventListener("abort", stop, { once: true });
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    assertNotAborted(opts.signal);
    if (code !== 0)
      throw new KiboError("INTERNAL", `static check exited with ${code}: ${stderr.slice(-STDERR_LIMIT)}`);
    return StaticCheck.parse(JSON.parse(stdout));
  } finally {
    opts.signal?.removeEventListener("abort", stop);
    stop();
  }
}
