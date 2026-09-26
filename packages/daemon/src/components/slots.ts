export type Slots = { acquire(): Promise<void>; release(): void; readonly busy: number };

export function createSlots(max: number): Slots {
  let busy = 0;
  const waiting: (() => void)[] = [];
  return {
    acquire() {
      if (busy < max) {
        busy += 1;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => waiting.push(resolve));
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
