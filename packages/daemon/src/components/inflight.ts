export type Inflight = {
  track<T>(work: Promise<T>): Promise<T>;
  drain(boundMs: number): Promise<void>;
};

export function createInflight(): Inflight {
  const running = new Set<Promise<unknown>>();
  return {
    track(work) {
      const tracked = work.finally(() => running.delete(tracked));
      running.add(tracked);
      return tracked;
    },
    async drain(boundMs) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let expired = false;
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          expired = true;
          resolve();
        }, boundMs);
      });
      while (running.size > 0 && !expired) {
        await Promise.race([Promise.allSettled([...running]), deadline]);
      }
      clearTimeout(timer);
      if (running.size > 0) console.error(`[kibo-daemon] ${running.size} requests still running at shutdown`);
    },
  };
}
