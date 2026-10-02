import { type RunView, SLOT_STATES } from "@kibo/schema";

export const holdsSlot = (r: RunView): boolean => SLOT_STATES.includes(r.state);

export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function guarded(what: string, action: () => void): void {
  try {
    action();
  } catch (e) {
    console.error(`[kibo-daemon] ${what} failed`, e);
  }
}
