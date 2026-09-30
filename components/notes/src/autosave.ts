import { KiboError, type NoteMeta } from "@kibo/schema";

export type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
type Timer = unknown;
export type AutosaveOptions = {
  delayMs: number;
  save(markdown: string, expectedMtime: number | null): Promise<NoteMeta>;
  onState(state: SaveState): void;
  onSaved?: (meta: NoteMeta) => void;
  onError?: (error: unknown) => void;
  setTimeout?: (fn: () => void, ms: number) => Timer;
  clearTimeout?: (t: Timer) => void;
};
export type Autosave = {
  change(markdown: string): void;
  flush(): Promise<boolean>;
  setBase(mtime: number | null): void;
  rebase(mtime: number): void;
  keepMine(): Promise<void>;
  dispose(): void;
};

export function createAutosave(opts: AutosaveOptions): Autosave {
  const later = opts.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancel = opts.clearTimeout ?? ((t: Timer) => clearTimeout(t as ReturnType<typeof setTimeout>));
  const report = opts.onError ?? ((e: unknown) => console.error(e));
  let base: number | null = null;
  let pending: string | null = null;
  let timer: Timer | null = null;
  let disposed = false;
  let queue: Promise<boolean> = Promise.resolve(true);

  const attempt = async (force: boolean): Promise<boolean> => {
    if (pending === null || disposed) return true;
    const text = pending;
    opts.onState("saving");
    try {
      const meta = await opts.save(text, force ? null : base);
      base = meta.mtime;
      if (pending === text) pending = null;
      opts.onSaved?.(meta);
      opts.onState(pending === null ? "saved" : "dirty");
      return true;
    } catch (e) {
      if (e instanceof KiboError && e.code === "CONFLICT") {
        opts.onState("conflict");
        return false;
      }
      report(e);
      opts.onState("error");
      return false;
    }
  };

  const write = (force: boolean): Promise<boolean> => {
    const next = queue.then(() => attempt(force));
    queue = next.catch(() => false);
    return next;
  };

  const stopTimer = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };

  return {
    change(markdown) {
      pending = markdown;
      opts.onState("dirty");
      stopTimer();
      timer = later(() => {
        timer = null;
        void write(false);
      }, opts.delayMs);
    },
    async flush() {
      stopTimer();
      while (pending !== null && !disposed) {
        if (!(await write(false))) return false;
      }
      return true;
    },
    setBase(mtime) {
      stopTimer();
      pending = null;
      base = mtime;
    },
    rebase(mtime) {
      base = mtime;
    },
    keepMine: async () => {
      await write(true);
    },
    dispose() {
      disposed = true;
      stopTimer();
    },
  };
}
