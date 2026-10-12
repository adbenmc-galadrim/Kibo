import { expect, test } from "bun:test";
import { NOW } from "../../agents/fixtures";
import { pendingBatch } from "../fixtures";
import { CLOSED_SIGNAL, emptySignals, OPEN_SIGNALS, signalFixture, signalsView } from "./fixtures";
import { boxSections, signalOutcome } from "./signal-sections";

test("open signals come newest first, closed ones apart", () => {
  const sections = boxSections(signalsView());
  expect(sections.open.map((s) => s.ref)).toEqual(["sig:3", "sig:2", "sig:1"]);
  expect(sections.closed.map((s) => s.ref)).toEqual(["sig:4"]);
});

test("at most 20 closed signals are kept, the most recently decided first", () => {
  const closed = Array.from({ length: 25 }, (_, i) =>
    signalFixture({ seq: i + 10, status: "ignored", decidedAt: NOW - (25 - i) * 1000 }),
  );
  const sections = boxSections(signalsView({ signals: [...OPEN_SIGNALS, ...closed] }));
  expect(sections.closed).toHaveLength(20);
  expect(sections.closed[0]?.ref).toBe("sig:34");
});

test("the wakeup line says due, last or none", () => {
  expect(boxSections(signalsView()).wakeup).toEqual({ kind: "due", at: NOW - 4 * 60_000 });
  const last = signalsView({ wakeup: { projectId: "kibo", lastAt: NOW - 1000, dueAt: null } });
  expect(boxSections(last).wakeup).toEqual({ kind: "last", at: NOW - 1000 });
  expect(boxSections(emptySignals()).wakeup).toBe("none");
  expect(boxSections(emptySignals()).open).toEqual([]);
  expect(CLOSED_SIGNAL.status).toBe("handled");
});

test("a closed signal says which batch closed it, and the created ticket", () => {
  const b2 = pendingBatch({
    id: "b2",
    seq: 2,
    results: [{ actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t31", key: "KIB-31" } }],
  });
  expect(signalOutcome(CLOSED_SIGNAL, [b2])).toBe("traité dans le lot n° 2 · KIB-31");
  expect(signalOutcome({ ...CLOSED_SIGNAL, actionId: 2 }, [b2])).toBe("traité dans le lot n° 2");
  expect(signalOutcome(CLOSED_SIGNAL, [])).toBe("traité dans un lot");
  const ignored = { ...CLOSED_SIGNAL, status: "ignored" as const };
  expect(signalOutcome({ ...ignored, batchId: null, actionId: null }, [b2])).toBe("ignoré");
  expect(signalOutcome(ignored, [b2])).toBe("sans suite, lot n° 2");
  expect(signalOutcome(OPEN_SIGNALS[0] ?? CLOSED_SIGNAL, [b2])).toBeNull();
});
