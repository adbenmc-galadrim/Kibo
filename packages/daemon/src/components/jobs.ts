import type { BackendDescription } from "@kibo/schema";

export type JobTarget = {
  projectId: string;
  instanceId: string;
  ref: string;
  config: Record<string, unknown>;
};
export type JobSchedulerDeps = {
  targets(): JobTarget[];
  describe(ref: string): Promise<BackendDescription>;
  run(target: JobTarget, job: string): Promise<void>;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (timer: unknown) => void;
  log?: (line: string) => void;
};
export type JobScheduler = { refresh(): Promise<void>; stop(): void; scheduled(): string[] };

type Wanted = { target: JobTarget; job: string; minutes: number };
type Cancel = () => void;
type Scheduled = { cancel: Cancel; signature: string };

const signatureOf = (w: Wanted) => JSON.stringify([w.target.ref, w.target.config, w.minutes]);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function timerFactory(deps: JobSchedulerDeps): (fn: () => void, ms: number) => Cancel {
  const set = deps.setInterval;
  const clear = deps.clearInterval;
  if (set && clear) {
    return (fn, ms) => {
      const timer = set(fn, ms);
      return () => clear(timer);
    };
  }
  return (fn, ms) => {
    const timer = setInterval(fn, ms);
    return () => clearInterval(timer);
  };
}

async function describeAll(
  deps: JobSchedulerDeps,
  refs: string[],
  log: (line: string) => void,
  stopped: () => boolean,
): Promise<Map<string, BackendDescription>> {
  const described = new Map<string, BackendDescription>();
  for (const ref of refs) {
    if (stopped()) break;
    try {
      described.set(ref, await deps.describe(ref));
    } catch (e) {
      log(`jobs of ${ref} not scheduled: ${message(e)}`);
    }
  }
  return described;
}

export function createJobScheduler(deps: JobSchedulerDeps): JobScheduler {
  const every = timerFactory(deps);
  const log = deps.log ?? ((line: string) => console.error(`[kibo-daemon] ${line}`));
  const timers = new Map<string, Scheduled>();
  const running = new Set<string>();
  let stopped = false;

  const tick = (key: string, w: Wanted) => {
    if (running.has(key)) return log(`job ${key} of ${w.target.ref} skipped: previous run not finished`);
    running.add(key);
    deps
      .run(w.target, w.job)
      .catch((e: unknown) => log(`job ${key} of ${w.target.ref} failed: ${message(e)}`))
      .finally(() => running.delete(key));
  };

  return {
    async refresh() {
      const targets = deps.targets();
      const described = await describeAll(deps, [...new Set(targets.map((t) => t.ref))], log, () => stopped);
      if (stopped) return;
      const wanted = new Map<string, Wanted>();
      for (const target of targets) {
        for (const job of described.get(target.ref)?.jobs ?? []) {
          wanted.set(`${target.instanceId}:${job.name}`, {
            target,
            job: job.name,
            minutes: job.everyMinutes,
          });
        }
      }
      for (const [key, scheduled] of timers) {
        const w = wanted.get(key);
        if (w && signatureOf(w) === scheduled.signature) continue;
        scheduled.cancel();
        timers.delete(key);
      }
      for (const [key, w] of wanted) {
        if (timers.has(key)) continue;
        timers.set(key, { cancel: every(() => tick(key, w), w.minutes * 60_000), signature: signatureOf(w) });
      }
    },
    stop() {
      stopped = true;
      for (const { cancel } of timers.values()) cancel();
      timers.clear();
    },
    scheduled: () => [...timers.keys()].sort(),
  };
}
