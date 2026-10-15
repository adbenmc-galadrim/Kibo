import type { MachineLock } from "@kibo/schema";

export type LocksWatch = { refresh(): boolean; current(): MachineLock[] };

export function createLocksWatch(read: (() => MachineLock[]) | undefined): LocksWatch {
  let locks: MachineLock[] = [];
  let signature = "[]";
  return {
    refresh() {
      if (!read) return false;
      try {
        const next = read();
        const nextSignature = JSON.stringify(next);
        if (nextSignature === signature) return false;
        locks = next;
        signature = nextSignature;
        return true;
      } catch (e) {
        console.error("[kibo-daemon] reading machine locks failed", e);
        return false;
      }
    },
    current: () => locks,
  };
}
