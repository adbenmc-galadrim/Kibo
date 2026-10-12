import { SIGNAL_WAKE_WINDOW_MS } from "@kibo/schema";

export type WakePlan = { kind: "now" } | { kind: "scheduled"; at: number } | { kind: "already"; at: number };

export function planWakeup(input: {
  lastAt: number | null;
  dueAt: number | null;
  now: number;
  window?: number;
}): WakePlan {
  if (input.dueAt !== null) return { kind: "already", at: input.dueAt };
  const window = input.window ?? SIGNAL_WAKE_WINDOW_MS;
  if (input.lastAt === null || input.now - input.lastAt >= window) return { kind: "now" };
  return { kind: "scheduled", at: input.lastAt + window };
}
