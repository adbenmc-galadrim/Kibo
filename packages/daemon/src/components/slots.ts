import { KiboError } from "@kibo/schema";

export type Slots = { acquire(timeoutMs?: number): Promise<void>; release(): void; readonly busy: number };

export function createSlots(max: number): Slots {
  let busy = 0;
  const waiting: (() => void)[] = [];
  const wait = (timeoutMs: number | undefined) =>
    new Promise<void>((resolve, reject) => {
      const timer =
        timeoutMs === undefined
          ? null
          : setTimeout(() => {
              waiting.splice(waiting.indexOf(grant), 1);
              reject(new KiboError("TIMEOUT", `no free slot after ${timeoutMs} ms`));
            }, timeoutMs);
      const grant = () => {
        if (timer) clearTimeout(timer);
        resolve();
      };
      waiting.push(grant);
    });
  return {
    acquire(timeoutMs) {
      if (busy < max) {
        busy += 1;
        return Promise.resolve();
      }
      return wait(timeoutMs);
    },
    release() {
      const next = waiting.shift();
      if (next) next();
      else busy -= 1;
    },
    get busy() {
      return busy;
    },
  };
}
