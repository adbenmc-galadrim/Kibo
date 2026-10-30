const GONE_CODES: ReadonlySet<unknown> = new Set(["ESRCH", "EPERM"]);

const isGone = (e: unknown) => e instanceof Error && "code" in e && GONE_CODES.has(e.code);

export function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (e) {
    // macOS answers EPERM, not ESRCH, for a group whose processes are all zombies
    if (isGone(e)) return false;
    throw e;
  }
}

export function tryKill(what: string, kill: () => unknown): void {
  try {
    kill();
  } catch (e) {
    console.error(`[kibo-daemon] ${what} failed`, e);
  }
}
