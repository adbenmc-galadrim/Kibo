import type { T3ThreadStatus } from "@kibo/schema";

const KNOWN: Readonly<Record<string, T3ThreadStatus>> = {
  preparing: "running",
  queued: "running",
  starting: "running",
  running: "running",
  waiting: "waiting",
  completed: "done",
  failed: "failed",
  interrupted: "failed",
  cancelled: "failed",
  rolled_back: "failed",
};

export const mapT3Status = (raw: string): T3ThreadStatus => KNOWN[raw] ?? "running";
