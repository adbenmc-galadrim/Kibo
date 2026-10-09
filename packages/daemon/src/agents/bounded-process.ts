export type BoundedResult = { code: number; stdout: string; stderr: string; timedOut: boolean };

function killGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch (e) {
    if (!(e instanceof Error && "code" in e && e.code === "ESRCH")) throw e;
  }
}

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
          killGroup(proc.pid);
        }, opts.timeoutMs);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);
  return { code, stdout, stderr, timedOut };
}
