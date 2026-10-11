import { signalGroup, tryKill } from "../process-group";

export type BoundedResult = { code: number; stdout: string; stderr: string; timedOut: boolean };

export async function runBounded(
  argv: string[],
  opts: { cwd: string; env: Record<string, string | undefined>; timeoutMs?: number },
): Promise<BoundedResult> {
  const proc = Bun.spawn(argv, {
    cwd: opts.cwd,
    env: opts.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  let timedOut = false;
  const timer =
    opts.timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          timedOut = true;
          tryKill(`killing process group ${proc.pid}`, () => signalGroup(proc.pid, "SIGKILL"));
        }, opts.timeoutMs);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);
  return { code, stdout, stderr, timedOut };
}
