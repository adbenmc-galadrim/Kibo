import type { KiboError } from "@kibo/schema";

export type SkippedNote = { path: string; error: KiboError };
export type SkippedNotes = {
  report(projectId: string, skipped: SkippedNote[]): void;
  forget(projectId: string): void;
};

export function createSkippedNotes(log: (line: string) => void): SkippedNotes {
  const reported = new Map<string, Map<string, string>>();
  return {
    report(projectId, skipped) {
      const before = reported.get(projectId);
      const now = new Map<string, string>();
      for (const { path, error } of skipped) {
        now.set(path, error.code);
        if (before?.get(path) !== error.code) log(`note ${path} skipped: ${error.message}`);
      }
      reported.set(projectId, now);
    },
    forget(projectId) {
      reported.delete(projectId);
    },
  };
}
