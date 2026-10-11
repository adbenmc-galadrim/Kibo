import { describe, expect, spyOn, test } from "bun:test";
import { KiboError, SIGNAL_WAKE_WINDOW_MS, WAKEUP_PREFIX } from "@kibo/schema";
import fc from "fast-check";
import { fakeWakeupStore } from "./signals.test-helper";
import { createWakeupScheduler, type WakeupDeps } from "./wakeup";

const MIN = 60_000;
const T0 = 1_000 * MIN;

type Timer = { fn: () => void; at: number; cleared: boolean };

function rig(over: Partial<WakeupDeps> = {}) {
  const store = fakeWakeupStore();
  store.kinds.set("p1", ["ticket", "blocker", "context"]);
  const sent: { projectId: string; text: string; at: number }[] = [];
  const timers: Timer[] = [];
  let clock = T0;
  let writable = true;
  const scheduler = createWakeupScheduler({
    store,
    send: (projectId, text) => {
      sent.push({ projectId, text, at: clock });
    },
    writable: () => writable,
    now: () => clock,
    setTimeout: (fn, ms) => {
      const timer = { fn, at: clock + ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (handle) => {
      const timer = timers.find((t) => t === handle);
      if (timer) timer.cleared = true;
    },
    ...over,
  });
  const live = () => timers.filter((t) => !t.cleared);
  return {
    store,
    sent,
    timers,
    live,
    scheduler,
    at(next: number) {
      clock = next;
    },
    setWritable(next: boolean) {
      writable = next;
    },
    fireDue(until: number) {
      for (const timer of live().sort((a, b) => a.at - b.at)) {
        if (timer.at > until || timer.cleared) continue;
        timer.cleared = true;
        clock = timer.at;
        timer.fn();
      }
      clock = until;
    },
  };
}

describe("createWakeupScheduler", () => {
  test("wakes the project agent at once when nothing was sent before", () => {
    const r = rig();
    expect(r.scheduler.request("p1", "ticket")).toEqual({ kind: "now" });
    expect(r.sent).toHaveLength(1);
    const text = r.sent[0]?.text ?? "";
    expect(text.startsWith(WAKEUP_PREFIX)).toBe(true);
    expect(text).toContain("2 signaux à traiter (1 ticket à créer, 1 blocage)");
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: T0, dueAt: null });
  });

  test("schedules one wake-up at the end of the window and joins later requests", () => {
    const r = rig();
    r.scheduler.request("p1", "ticket");
    r.at(T0 + 9 * MIN);
    expect(r.scheduler.request("p1", "blocker")).toEqual({ kind: "scheduled", at: T0 + 10 * MIN });
    expect(r.sent).toHaveLength(1);
    expect(r.live().map((t) => t.at)).toEqual([T0 + 10 * MIN]);
    expect(r.store.wakeup("p1").dueAt).toBe(T0 + 10 * MIN);
    expect(r.scheduler.request("p1", "ticket")).toEqual({ kind: "already", at: T0 + 10 * MIN });
    expect(r.live()).toHaveLength(1);
    r.fireDue(T0 + 10 * MIN);
    expect(r.sent.map((s) => s.at)).toEqual([T0, T0 + 10 * MIN]);
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: T0 + 10 * MIN, dueAt: null });
  });

  test("drops the deadline without waking when no ticket or blocker is open any more", () => {
    const r = rig();
    r.scheduler.request("p1", "ticket");
    r.at(T0 + MIN);
    r.scheduler.request("p1", "ticket");
    r.store.kinds.set("p1", ["context"]);
    r.fireDue(T0 + 10 * MIN);
    expect(r.sent).toHaveLength(1);
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: T0, dueAt: null });
  });

  test("never wakes a project this instance cannot write", () => {
    const r = rig();
    r.setWritable(false);
    r.scheduler.request("p1", "blocker");
    expect(r.sent).toHaveLength(0);
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: null, dueAt: null });
  });

  test("context and question never wake the project agent", () => {
    const r = rig();
    expect(r.scheduler.request("p1", "context")).toEqual({ kind: "none" });
    expect(r.scheduler.request("p1", "question")).toEqual({ kind: "none" });
    expect(r.sent).toHaveLength(0);
    expect(r.store.wakeups.size).toBe(0);
  });

  test("start fires past deadlines and re-arms future ones", () => {
    const r = rig();
    r.store.kinds.set("p2", ["ticket"]);
    r.store.kinds.set("p3", ["blocker"]);
    r.store.saveWakeup({ projectId: "p2", lastAt: T0 - 20 * MIN, dueAt: T0 - 1 });
    r.store.saveWakeup({ projectId: "p3", lastAt: T0 - 5 * MIN, dueAt: T0 + 30_000 });
    r.scheduler.start();
    expect(r.sent.map((s) => s.projectId)).toEqual(["p2"]);
    expect(r.live().map((t) => t.at)).toEqual([T0 + 30_000]);
    r.fireDue(T0 + 30_000);
    expect(r.sent.map((s) => s.projectId)).toEqual(["p2", "p3"]);
  });

  test("stop clears every pending timer", () => {
    const r = rig();
    r.store.kinds.set("p2", ["ticket"]);
    r.scheduler.request("p1", "ticket");
    r.scheduler.request("p2", "ticket");
    r.at(T0 + MIN);
    r.scheduler.request("p1", "ticket");
    r.scheduler.request("p2", "ticket");
    expect(r.live()).toHaveLength(2);
    r.scheduler.stop();
    expect(r.live()).toHaveLength(0);
  });

  test("a failing send is logged and still closes the window", () => {
    const errors = spyOn(console, "error").mockImplementation(() => undefined);
    const r = rig({
      send: () => {
        throw new KiboError("CONFLICT", "busy");
      },
    });
    expect(() => r.scheduler.request("p1", "ticket")).not.toThrow();
    expect(errors).toHaveBeenCalled();
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: T0, dueAt: null });
    errors.mockRestore();
  });

  test("two wake-ups of a project are always a window apart", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ gap: fc.nat({ max: 3 * SIGNAL_WAKE_WINDOW_MS }), blocker: fc.boolean() }), {
          minLength: 1,
          maxLength: 120,
        }),
        (steps) => {
          const r = rig();
          let t = T0;
          for (const step of steps) {
            t += step.gap;
            r.fireDue(t);
            r.scheduler.request("p1", step.blocker ? "blocker" : "ticket");
          }
          r.fireDue(t + SIGNAL_WAKE_WINDOW_MS);
          const at = r.sent.map((s) => s.at);
          return at.every((x, i) => i === 0 || x - (at[i - 1] ?? 0) >= SIGNAL_WAKE_WINDOW_MS);
        },
      ),
    );
  });
});
