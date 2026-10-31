import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

export type BashRun = { stdout: string; stderr: string; code: number };

function kiboShim(stateDir: string, cli: string): string {
  const bin = join(stateDir, "bin");
  mkdirSync(bin, { recursive: true });
  const shim = join(bin, "kibo");
  writeFileSync(shim, `#!/bin/sh\nexec '${process.execPath}' '${cli}' "$@"\n`);
  chmodSync(shim, 0o755);
  return bin;
}

export async function runBash(command: string, stateDir: string, env: NodeJS.ProcessEnv): Promise<BashRun> {
  const cli = env.KIBO_CLI;
  const path = cli ? [kiboShim(stateDir, cli), env.PATH ?? ""].join(delimiter) : (env.PATH ?? "");
  const proc = Bun.spawn(["sh", "-c", command], {
    cwd: process.cwd(),
    env: { ...env, PATH: path },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

export const bashResponse = (run: BashRun) => ({
  stdout: run.stdout,
  stderr: run.stderr,
  interrupted: false,
  isImage: false,
});
