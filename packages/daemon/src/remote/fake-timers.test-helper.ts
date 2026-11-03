import type { RemoteTimers } from "./timers";

type Timer = { id: number; at: number; ms: number; run(): void; repeat: boolean };

export type FakeTimers = RemoteTimers & {
  now(): number;
  advance(ms: number): Promise<void>;
  delays(): number[];
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function createFakeTimers(start = 1_760_000_000_000): FakeTimers {
  let clock = start;
  let nextId = 0;
  const timers = new Map<number, Timer>();
  const add = (ms: number, run: () => void, repeat: boolean) => {
    const id = nextId++;
    timers.set(id, { id, at: clock + ms, ms, run, repeat });
    return () => {
      timers.delete(id);
    };
  };
  const due = (until: number) =>
    [...timers.values()].filter((t) => t.at <= until).sort((a, b) => a.at - b.at || a.id - b.id)[0];
  return {
    after: (ms, run) => add(ms, run, false),
    every: (ms, run) => add(ms, run, true),
    now: () => clock,
    delays: () => [...timers.values()].filter((t) => !t.repeat).map((t) => t.ms),
    advance: async (ms) => {
      const until = clock + ms;
      for (let timer = due(until); timer; timer = due(until)) {
        clock = timer.at;
        if (timer.repeat) timer.at += timer.ms;
        else timers.delete(timer.id);
        timer.run();
        await settle();
      }
      clock = until;
      await settle();
    },
  };
}
