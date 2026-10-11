import { type WakeReply, wakeupMessage } from "@kibo/core/signals/messages";
import { planWakeup } from "@kibo/core/signals/wakeup";
import { SIGNAL_WAKE_WINDOW_MS, type Signal, type SignalKind, WAKE_KINDS, type Wakeup } from "@kibo/schema";

export type WakeupStore = {
  wakeup(projectId: string): Wakeup;
  saveWakeup(wakeup: Wakeup): void;
  due(): Wakeup[];
  open(projectId: string): Signal[];
};

export type WakeupDeps = {
  store: WakeupStore;
  send(projectId: string, text: string): void;
  writable(projectId: string): boolean;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  window?: number;
};

export type WakeupScheduler = {
  request(projectId: string, kind: SignalKind): WakeReply;
  start(): void;
  stop(): void;
};

const systemSetTimeout = (fn: () => void, ms: number): (() => void) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};
const systemClearTimeout = (handle: unknown): void => {
  if (typeof handle === "function") handle();
};

export function createWakeupScheduler(deps: WakeupDeps): WakeupScheduler {
  const now = deps.now ?? Date.now;
  const arm = deps.setTimeout ?? systemSetTimeout;
  const disarm = deps.clearTimeout ?? systemClearTimeout;
  const window = deps.window ?? SIGNAL_WAKE_WINDOW_MS;
  const timers = new Map<string, unknown>();

  function clear(projectId: string): void {
    const handle = timers.get(projectId);
    if (handle === undefined) return;
    timers.delete(projectId);
    disarm(handle);
  }

  function send(projectId: string, triggers: readonly Signal[]): void {
    try {
      deps.send(projectId, wakeupMessage(triggers));
    } catch (e) {
      console.error(`[kibo-daemon] waking the project agent of ${projectId} failed`, e);
    }
  }

  function fire(projectId: string): void {
    clear(projectId);
    const current = deps.store.wakeup(projectId);
    const triggers = deps.store.open(projectId).filter((s) => WAKE_KINDS.includes(s.kind));
    if (!deps.writable(projectId) || triggers.length === 0) {
      deps.store.saveWakeup({ ...current, dueAt: null });
      return;
    }
    const at = now();
    send(projectId, triggers);
    deps.store.saveWakeup({ projectId, lastAt: at, dueAt: null });
  }

  function schedule(projectId: string, at: number): void {
    clear(projectId);
    timers.set(
      projectId,
      arm(() => fire(projectId), Math.max(0, at - now())),
    );
  }

  return {
    request(projectId, kind) {
      if (!WAKE_KINDS.includes(kind)) return { kind: "none" };
      const current = deps.store.wakeup(projectId);
      const plan = planWakeup({ lastAt: current.lastAt, dueAt: current.dueAt, now: now(), window });
      if (plan.kind === "now") fire(projectId);
      if (plan.kind === "scheduled") {
        deps.store.saveWakeup({ ...current, dueAt: plan.at });
        schedule(projectId, plan.at);
      }
      return plan;
    },
    start() {
      for (const wakeup of deps.store.due()) {
        if (wakeup.dueAt === null) continue;
        if (wakeup.dueAt <= now()) fire(wakeup.projectId);
        else schedule(wakeup.projectId, wakeup.dueAt);
      }
    },
    stop() {
      for (const projectId of [...timers.keys()]) clear(projectId);
    },
  };
}
