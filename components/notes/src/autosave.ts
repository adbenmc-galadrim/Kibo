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
  flush(): Promise<void>;
  setBase(mtime: number | null): void;
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

  const write = async (force: boolean) => {
    if (pending === null || disposed) return;
    const text = pending;
    opts.onState("saving");
    try {
      const meta = await opts.save(text, force ? null : base);
      base = meta.mtime;
      if (pending === text) pending = null;
      opts.onSaved?.(meta);
      opts.onState(pending === null ? "saved" : "dirty");
    } catch (e) {
      if (e instanceof KiboError && e.code === "CONFLICT") {
        opts.onState("conflict");
        return;
      }
      report(e);
      opts.onState("error");
    }
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
      await write(false);
    },
    setBase(mtime) {
      stopTimer();
      pending = null;
      base = mtime;
    },
    keepMine: () => write(true),
    dispose() {
      disposed = true;
      stopTimer();
    },
  };
}
