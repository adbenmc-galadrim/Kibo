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
): Promise<Map<string, BackendDescription>> {
  const described = new Map<string, BackendDescription>();
  for (const ref of refs) {
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
  const timers = new Map<string, Cancel>();
  const running = new Set<string>();

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
      const described = await describeAll(deps, [...new Set(targets.map((t) => t.ref))], log);
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
      for (const [key, cancel] of timers) {
        if (wanted.has(key)) continue;
        cancel();
        timers.delete(key);
      }
      for (const [key, w] of wanted) {
        if (!timers.has(key))
          timers.set(
            key,
            every(() => tick(key, w), w.minutes * 60_000),
          );
      }
    },
    stop() {
      for (const cancel of timers.values()) cancel();
      timers.clear();
    },
    scheduled: () => [...timers.keys()].sort(),
  };
}
