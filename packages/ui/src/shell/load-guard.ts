export type EscapeReason = "reload" | "no-ready";

export type LoadGuardDeps<T> = {
  readyTimeoutMs: number;
  onEscape(reason: EscapeReason): void;
  setTimer(fn: () => void, ms: number): T;
  clearTimer(timer: T): void;
};

export type LoadGuard = {
  ready(): void;
  load(): void;
  dispose(): void;
};

export function createLoadGuard<T>(deps: LoadGuardDeps<T>): LoadGuard {
  let loads = 0;
  let readySeen = false;
  let over = false;
  let timer: { id: T } | null = null;

  const stopTimer = () => {
    if (timer) deps.clearTimer(timer.id);
    timer = null;
  };
  const giveUp = (reason: EscapeReason) => {
    if (over) return;
    over = true;
    stopTimer();
    deps.onEscape(reason);
  };

  return {
    ready() {
      readySeen = true;
      stopTimer();
    },
    load() {
      if (over) return;
      loads += 1;
      if (loads > 1) {
        giveUp("reload");
        return;
      }
      if (readySeen) return;
      timer = { id: deps.setTimer(() => giveUp("no-ready"), deps.readyTimeoutMs) };
    },
    dispose() {
      over = true;
      stopTimer();
    },
  };
}
