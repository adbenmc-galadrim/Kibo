import { KiboError, type RunPeek } from "@kibo/schema";

export type MockRuns = { peek(runId: string): RunPeek; open(runId: string): void; opened: string[] };

export function createMockRuns(peeks: Record<string, RunPeek>): MockRuns {
  const opened: string[] = [];
  return {
    peek(runId) {
      const peek = peeks[runId];
      if (!peek) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
      return structuredClone(peek);
    },
    open: (runId) => {
      opened.push(runId);
    },
    opened,
  };
}
