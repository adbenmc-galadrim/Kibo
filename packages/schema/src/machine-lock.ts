import type { AgentsState } from "./run";

export type LockTicket = {
  ticket: string;
  label: string;
  pid: number;
  since: number;
  cwd: string;
  alive: boolean;
};
export type MachineLock = { name: string; max: number; held: LockTicket[]; waiting: LockTicket[] };

export const machineLocks = (state: Pick<AgentsState, "locks">): MachineLock[] => state.locks ?? [];
export const machineLocksDir = (state: Pick<AgentsState, "locksDir">): string | null =>
  state.locksDir ?? null;
