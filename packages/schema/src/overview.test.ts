import { expect, test } from "bun:test";
import { nextFeature } from "./feature-state";
import { featureSteps } from "./feature-steps";
import { nextDeliverableStep } from "./next-step";
import { limitNote, nextToOpen, overviewIndicators, reviewCards } from "./overview";
import { emisSnapshot, emisTickets, META, TODAY } from "./overview-test-kit";

test("the indicators of the mockup project", () => {
  const indicators = overviewIndicators({ snapshot: emisSnapshot(), today: TODAY });
  expect(indicators.features).toEqual({
    delivered: 3,
    total: 9,
    cells: ["delivered", "delivered", "delivered", "open", "open", "todo", "todo", "todo", "todo"],
  });
  expect(indicators.sprint).toEqual({ code: "S42", name: "Terrain hors ligne", ending: "today" });
  expect(indicators.open).toEqual({ count: 2, limit: 2, level: "reached" });
  expect(indicators.review).toEqual({ count: 3, numbers: [20, 22, 23] });
  expect(indicators.questions).toEqual({ open: 3, blocking: { ref: "Q14", shortKey: "F6" } });
});

test("the current sprint ends in days, else the next one is announced", () => {
  const snapshot = emisSnapshot();
  expect(overviewIndicators({ snapshot, today: "2026-10-20" }).sprint).toEqual({
    code: "S43",
    name: "Import et soudures",
    ending: { days: 3 },
  });
  expect(overviewIndicators({ snapshot, today: "2026-10-17" }).sprint).toEqual({
    next: { code: "S43", start: "2026-10-19" },
  });
  expect(overviewIndicators({ snapshot, today: "2026-12-01" }).sprint).toEqual({ next: null });
});

test("the open level follows the project limit", () => {
  const snapshot = emisSnapshot();
  const withLimit = (openLimit: number) => ({ ...snapshot, meta: { ...META, tracking: { openLimit } } });
  expect(overviewIndicators({ snapshot: withLimit(3), today: TODAY }).open.level).toBe("under");
  expect(overviewIndicators({ snapshot: withLimit(1), today: TODAY }).open).toEqual({
    count: 2,
    limit: 1,
    level: "over",
  });
});

test("without a blocking question, none is named", () => {
  const snapshot = emisSnapshot();
  const questions = snapshot.questions.map((q) => ({ ...q, blocking: false }));
  expect(overviewIndicators({ snapshot: { ...snapshot, questions }, today: TODAY }).questions).toEqual({
    open: 3,
    blocking: null,
  });
});

test("the limit note names the open features and the one that waits", () => {
  expect(limitNote({ open: ["F4", "F5"], next: "F6", limit: 2 })).toEqual({ open: ["F4", "F5"], next: "F6" });
  expect(limitNote({ open: ["F4"], next: "F6", limit: 2 })).toBeNull();
  expect(limitNote({ open: ["F4", "F5"], next: null, limit: 2 })).toBeNull();
  expect(nextToOpen(emisSnapshot())).toBe("F6");
});

test("the next feature to finish and its next step", () => {
  const tickets = emisTickets();
  const s42 = tickets.flatMap((t, rank) =>
    t.feature !== null && t.sprintId === "s42" ? [{ id: t.id, rank, state: t.feature }] : [],
  );
  expect(nextFeature(s42)).toBe("EMIS-40");
  const next = (feature: string) => nextDeliverableStep(featureSteps({ feature, tickets, links: [] }));
  expect(next("EMIS-40")).toBe("EMIS-45");
  expect(next("EMIS-30")).toBe("EMIS-34");
});

test("pull requests in review, the most recent first", () => {
  const tickets = emisTickets();
  const lastEventAt = new Map([
    ["EMIS-45", 200],
    ["EMIS-32", 300],
    ["EMIS-61", 100],
  ]);
  const cards = reviewCards(tickets, lastEventAt);
  expect(cards.map((c) => c.pr.number)).toEqual([22, 20, 23]);
  expect(cards.map((c) => c.feature)).toEqual([{ shortKey: "F5" }, { shortKey: "F4" }, null]);
  expect(cards[0]?.ticket.id).toBe("EMIS-32");
  expect(reviewCards(tickets, new Map()).map((c) => c.pr.number)).toEqual([20, 22, 23]);
});
