import { describe, expect, spyOn, test } from "bun:test";
import { KiboError, SIGNAL_WAKE_WINDOW_MS, WAKEUP_PREFIX } from "@kibo/schema";
import fc from "fast-check";
import { fakeWakeupStore } from "./signals.test-helper";
import { ANSWER_WAKE_GRACE_MS, createWakeupScheduler, type WakeupDeps } from "./wakeup";

const MIN = 60_000;
const T0 = 1_000 * MIN;
const GRACE = ANSWER_WAKE_GRACE_MS;

type Timer = { fn: () => void; at: number; cleared: boolean };

function rig(over: Partial<WakeupDeps> = {}) {
  const store = fakeWakeupStore();
  store.kinds.set("p1", ["ticket", "blocker", "context"]);
  const sent: { projectId: string; text: string; at: number }[] = [];
  const timers: Timer[] = [];
  let clock = T0;
  let writable = true;
  const labels = new Map([
    ["q16", "Q16"],
    ["q17", "Q17"],
  ]);
  const quotes = new Map([
    ["q16", "5 Go"],
    ["q17", "Oui"],
  ]);
  const scheduler = createWakeupScheduler({
    store,
    answered: (_projectId, ids) =>
      ids.flatMap((id) => {
        const quote = quotes.get(id);
        return quote === undefined ? [] : [{ label: labels.get(id) ?? "Q?", quote }];
      }),
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
    quotes,
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

  test("a timer whose project throws is logged and the next project still wakes up", () => {
    const errors = spyOn(console, "error").mockImplementation(() => undefined);
    const r = rig({
      writable: (projectId) => {
        if (projectId === "p1") throw new KiboError("NOT_FOUND", "project deleted");
        return true;
      },
    });
    r.store.kinds.set("p2", ["ticket"]);
    r.store.saveWakeup({ projectId: "p1", lastAt: T0 - 5 * MIN, dueAt: T0 + MIN });
    r.store.saveWakeup({ projectId: "p2", lastAt: T0 - 5 * MIN, dueAt: T0 + MIN });
    r.scheduler.start();
    expect(() => r.fireDue(T0 + MIN)).not.toThrow();
    expect(r.sent.map((s) => s.projectId)).toEqual(["p2"]);
    expect(String(errors.mock.calls[0]?.[0])).toContain("p1");
    expect(r.live()).toHaveLength(0);
    errors.mockRestore();
  });

  test("a store failure while replaying one project does not stop the others", () => {
    const errors = spyOn(console, "error").mockImplementation(() => undefined);
    const r = rig();
    const open = r.store.open;
    r.store.open = (projectId) => {
      if (projectId === "p1") throw new Error("database is closed");
      return open(projectId);
    };
    r.store.kinds.set("p2", ["blocker"]);
    r.store.saveWakeup({ projectId: "p1", lastAt: T0 - 20 * MIN, dueAt: T0 - 1 });
    r.store.saveWakeup({ projectId: "p2", lastAt: T0 - 20 * MIN, dueAt: T0 - 1 });
    expect(() => r.scheduler.start()).not.toThrow();
    expect(r.sent.map((s) => s.projectId)).toEqual(["p2"]);
    expect(errors.mock.calls.some((c) => String(c[0]).includes("p1"))).toBe(true);
    errors.mockRestore();
  });

  test("two wake-ups of a project are always a window apart, answers included", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            gap: fc.nat({ max: 3 * SIGNAL_WAKE_WINDOW_MS }),
            kind: fc.constantFrom("ticket", "blocker", "answer"),
          }),
          {
            minLength: 1,
            maxLength: 120,
          },
        ),
        (steps) => {
          const r = rig();
          let t = T0;
          for (const step of steps) {
            t += step.gap;
            r.fireDue(t);
            if (step.kind === "answer") r.scheduler.requestAnswer("p1", "q16");
            else r.scheduler.request("p1", step.kind);
          }
          r.fireDue(t + SIGNAL_WAKE_WINDOW_MS);
          const at = r.sent.map((s) => s.at);
          return at.every((x, i) => i === 0 || x - (at[i - 1] ?? 0) >= SIGNAL_WAKE_WINDOW_MS);
        },
      ),
    );
  });
});

describe("waking on an answer", () => {
  function answerRig(over: Partial<WakeupDeps> = {}) {
    const r = rig(over);
    r.store.kinds.set("p1", []);
    return r;
  }

  test("waits a grace delay, then sends one message citing the answer", () => {
    const r = answerRig();
    expect(r.scheduler.requestAnswer("p1", "q16")).toEqual({ kind: "scheduled", at: T0 + GRACE });
    expect(r.sent).toHaveLength(0);
    expect(r.store.wakeup("p1").dueAt).toBe(T0 + GRACE);
    expect(r.live().map((t) => t.at)).toEqual([T0 + GRACE]);
    r.fireDue(T0 + GRACE);
    expect(r.sent).toHaveLength(1);
    const text = r.sent[0]?.text ?? "";
    expect(text.startsWith(`${WAKEUP_PREFIX}1 réponse à lire.`)).toBe(true);
    expect(text).toContain("- Q16 répondue : « 5 Go »");
    expect(r.store.queuedAnswers("p1")).toEqual([]);
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: T0 + GRACE, dueAt: null });
  });

  test("answers given during the grace delay make a single turn", () => {
    const r = answerRig();
    r.scheduler.requestAnswer("p1", "q16");
    r.at(T0 + 10_000);
    expect(r.scheduler.requestAnswer("p1", "q17")).toEqual({ kind: "already", at: T0 + GRACE });
    r.fireDue(T0 + GRACE);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]?.text).toContain(
      "2 réponses à lire.\n- Q16 répondue : « 5 Go »\n- Q17 répondue : « Oui »",
    );
  });

  test("a grace delay of zero wakes at once", () => {
    const r = answerRig({ grace: 0 });
    expect(r.scheduler.requestAnswer("p1", "q16")).toEqual({ kind: "now" });
    expect(r.sent.map((s) => s.at)).toEqual([T0]);
  });

  test("later answers join the end of the window, in the order they were given", () => {
    const r = answerRig();
    r.scheduler.requestAnswer("p1", "q16");
    r.fireDue(T0 + GRACE);
    r.at(T0 + GRACE + MIN);
    expect(r.scheduler.requestAnswer("p1", "q17")).toEqual({ kind: "scheduled", at: T0 + GRACE + 10 * MIN });
    r.at(T0 + GRACE + 2 * MIN);
    expect(r.scheduler.requestAnswer("p1", "q16")).toEqual({
      kind: "already",
      at: T0 + GRACE + 10 * MIN,
    });
    expect(r.sent).toHaveLength(1);
    r.fireDue(T0 + GRACE + 10 * MIN);
    expect(r.sent).toHaveLength(2);
    expect(r.sent[1]?.text).toContain(
      "2 réponses à lire.\n- Q17 répondue : « Oui »\n- Q16 répondue : « 5 Go »",
    );
  });

  test("an answer changed before the deadline is cited as it is now, once", () => {
    const r = answerRig();
    r.scheduler.requestAnswer("p1", "q16");
    r.scheduler.requestAnswer("p1", "q16");
    r.quotes.set("q16", "2 Go");
    r.fireDue(T0 + GRACE);
    const text = r.sent[0]?.text ?? "";
    expect(text).toContain("- Q16 répondue : « 2 Go »");
    expect(text.split("répondue").length).toBe(2);
  });

  test("an answer withdrawn without any signal sends nothing and empties the queue", () => {
    const r = answerRig();
    r.store.saveWakeup({ projectId: "p1", lastAt: T0 - 20 * MIN, dueAt: null });
    r.scheduler.requestAnswer("p1", "q16");
    r.quotes.delete("q16");
    r.fireDue(T0 + GRACE);
    expect(r.sent).toHaveLength(0);
    expect(r.store.queuedAnswers("p1")).toEqual([]);
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: T0 - 20 * MIN, dueAt: null });
  });

  test("a project this instance cannot write is never woken and its queue is emptied", () => {
    const r = answerRig();
    r.setWritable(false);
    r.scheduler.requestAnswer("p1", "q16");
    r.fireDue(T0 + GRACE);
    expect(r.sent).toHaveLength(0);
    expect(r.store.queuedAnswers("p1")).toEqual([]);
  });

  test("a blocker keeps its immediate wake-up and carries the waiting answer", () => {
    const r = answerRig();
    r.scheduler.requestAnswer("p1", "q16");
    r.store.kinds.set("p1", ["ticket", "blocker"]);
    r.at(T0 + 5_000);
    expect(r.scheduler.request("p1", "blocker")).toEqual({ kind: "now" });
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]?.text).toContain(
      "2 signaux à traiter (1 ticket à créer, 1 blocage) et 1 réponse à lire.\n- Q16 répondue : « 5 Go »",
    );
    expect(r.live()).toHaveLength(0);
    expect(r.store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: T0 + 5_000, dueAt: null });
    r.fireDue(T0 + GRACE);
    expect(r.sent).toHaveLength(1);
  });

  test("a deadline left by the previous daemon replays the waiting answers at start", () => {
    const r = answerRig();
    r.store.queueAnswer("p1", "q17", T0 - MIN);
    r.store.saveWakeup({ projectId: "p1", lastAt: T0 - 20 * MIN, dueAt: T0 - 1 });
    r.scheduler.start();
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]?.text).toContain("- Q17 répondue : « Oui »");
    expect(r.store.queuedAnswers("p1")).toEqual([]);
  });
});
