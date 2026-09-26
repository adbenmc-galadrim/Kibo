const isMissing = (e: unknown) => e instanceof Error && "code" in e && e.code === "ESRCH";

export function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (e) {
    if (isMissing(e)) return false;
    throw e;
  }
}
