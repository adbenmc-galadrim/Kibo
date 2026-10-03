import { KiboError } from "@kibo/schema";
import { type DaemonInfo, readDaemonInfo } from "./components/daemon-info";

export type HealthAnswer = { pid: number } | "refused" | "silent";
export type Probe = (port: number) => Promise<HealthAnswer>;
export type RunningDaemon = { info: DaemonInfo; answers: boolean };

export const HEALTH_TIMEOUT_MS = 1_000;

const isTimeout = (e: unknown): boolean => e instanceof Error && e.name === "TimeoutError";

const pidOf = (body: unknown): number | null => {
  const pid: unknown = typeof body === "object" && body !== null ? Reflect.get(body, "pid") : null;
  return typeof pid === "number" && Number.isInteger(pid) && pid > 0 ? pid : null;
};

export const probeHealth: Probe = async (port) => {
  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
  } catch (e) {
    return isTimeout(e) ? "silent" : "refused";
  }
  if (!res.ok) return "silent";
  const pid = pidOf(await res.json().catch(() => null));
  return pid === null ? "silent" : { pid };
};

function readInfo(home: string): DaemonInfo | null {
  try {
    return readDaemonInfo(home);
  } catch (e) {
    if (e instanceof KiboError && e.code === "STORE_CORRUPT") return null;
    throw e;
  }
}

export async function findRunningDaemon(
  home: string,
  probe: Probe = probeHealth,
): Promise<RunningDaemon | null> {
  const info = readInfo(home);
  if (!info) return null;
  const answer = await probe(info.port);
  if (answer === "refused") return null;
  return { info, answers: answer !== "silent" };
}

export class DaemonRunning extends KiboError {
  constructor(
    readonly home: string,
    readonly running: RunningDaemon,
  ) {
    const where = `http://127.0.0.1:${running.info.port}`;
    super(
      "DAEMON_RUNNING",
      running.answers
        ? `another daemon (pid ${running.info.pid}) serves ${home} at ${where}`
        : `another daemon (pid ${running.info.pid}) holds ${home} at ${where} and does not answer`,
    );
    this.name = "DaemonRunning";
  }
}
