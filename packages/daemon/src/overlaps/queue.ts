export type RunQueue = {
  push(runId: string, job: () => Promise<void>): Promise<void>;
  idle(runId: string): Promise<void>;
};

export function createRunQueue(log: (line: string) => void): RunQueue {
  const chains = new Map<string, Promise<void>>();
  return {
    push(runId, job) {
      const next = (chains.get(runId) ?? Promise.resolve()).then(job).catch((e: unknown) => {
        log(`overlaps: job of run ${runId} failed: ${String(e)}`);
      });
      chains.set(runId, next);
      void next.then(() => {
        if (chains.get(runId) === next) chains.delete(runId);
      });
      return next;
    },
    idle: (runId) => chains.get(runId) ?? Promise.resolve(),
  };
}
