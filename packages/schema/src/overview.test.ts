import { expect, test } from "bun:test";
import { nextFeature } from "./feature-state";
import { featureSteps } from "./feature-steps";
import { lateFeatures } from "./late-features";
import { nextDeliverableStep } from "./next-step";
import { limitNote, nextToOpen, overviewIndicators, plannedFeatures, reviewCards } from "./overview";
import { META, siloSnapshot, siloTickets, TODAY } from "./overview-test-kit";

const plannedLate = (snapshot: ReturnType<typeof siloSnapshot>) =>
  plannedFeatures(snapshot).map((f) => ({
    id: f.ticket.id,
    sprintId: f.ticket.sprintId,
    rank: f.rank,
    remaining: f.state.remaining,
  }));

test("the indicators of the mockup project", () => {
  const indicators = overviewIndicators({ snapshot: siloSnapshot(), today: TODAY });
  expect(indicators.features).toEqual({
    delivered: 3,
    total: 9,
    cells: ["delivered", "delivered", "delivered", "open", "open", "todo", "todo", "todo", "todo"],
    late: 0,
  });
  expect(indicators.sprint).toEqual({ code: "S42", name: "Saisie hors ligne", ending: "today" });
  expect(indicators.open).toEqual({ count: 2, limit: 2, level: "reached" });
  expect(indicators.review).toEqual({ count: 3, numbers: [20, 22, 23] });
  expect(indicators.questions).toEqual({ open: 3, blocking: { ref: "Q14", shortKey: "F6" } });
  expect(indicators.blocked).toEqual({ count: 1 });
});

test("late features are counted once their sprint is over", () => {
  const snapshot = siloSnapshot();
  const late = (today: string) => overviewIndicators({ snapshot, today }).features.late;
  expect(late(TODAY)).toBe(0);
  expect(late("2026-10-17")).toBe(lateFeatures(plannedLate(snapshot), snapshot.sprints, "2026-10-17").length);
  expect(late("2026-10-17")).toBe(2);
});

test("blocked steps and open blocking questions are counted together", () => {
  const snapshot = siloSnapshot();
  const stuck = new Set(["SILO-33", "SILO-34", "SILO-35", "SILO-46"]);
  const tickets = snapshot.tickets.map((t) =>
    stuck.has(t.id) ? { ...t, statusId: "blocked" as const, blockedReason: "Attente" } : t,
  );
  expect(overviewIndicators({ snapshot: { ...snapshot, tickets }, today: TODAY }).blocked).toEqual({
    count: 5,
  });
});

test("the current sprint ends in days or lingers, else the next one is announced", () => {
  const snapshot = siloSnapshot();
  expect(overviewIndicators({ snapshot, today: "2026-10-20" }).sprint).toEqual({
    code: "S43",
    name: "Import et contrats",
    ending: { days: 3 },
  });
  expect(overviewIndicators({ snapshot, today: "2026-10-17" }).sprint).toEqual({
    code: "S42",
    name: "Saisie hors ligne",
    ending: { ended: "2026-10-16" },
  });
  expect(overviewIndicators({ snapshot, today: "2026-12-01" }).sprint).toEqual({
    code: "S44",
    name: "Rapports",
    ending: { ended: "2026-10-30" },
  });
  expect(overviewIndicators({ snapshot, today: "2026-10-01" }).sprint).toEqual({
    next: { code: "S41", start: "2026-10-05" },
  });
  expect(overviewIndicators({ snapshot: { ...snapshot, sprints: [] }, today: TODAY }).sprint).toEqual({
    next: null,
  });
});

test("the open level follows the project limit", () => {
  const snapshot = siloSnapshot();
  const withLimit = (openLimit: number) => ({ ...snapshot, meta: { ...META, tracking: { openLimit } } });
  expect(overviewIndicators({ snapshot: withLimit(3), today: TODAY }).open.level).toBe("under");
  expect(overviewIndicators({ snapshot: withLimit(1), today: TODAY }).open).toEqual({
    count: 2,
    limit: 1,
    level: "over",
  });
});

test("without a blocking question, none is named", () => {
  const snapshot = siloSnapshot();
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
  expect(nextToOpen(siloSnapshot())).toBe("F6");
});

test("the next feature to finish and its next step", () => {
  const tickets = siloTickets();
  const s42 = tickets.flatMap((t, rank) =>
    t.feature !== null && t.sprintId === "s42" ? [{ id: t.id, rank, state: t.feature }] : [],
  );
  expect(nextFeature(s42)).toBe("SILO-40");
  const next = (feature: string) => nextDeliverableStep(featureSteps({ feature, tickets, links: [] }));
  expect(next("SILO-40")).toBe("SILO-45");
  expect(next("SILO-30")).toBe("SILO-34");
});

test("pull requests in review, the most recent first", () => {
  const tickets = siloTickets();
  const lastEventAt = new Map([
    ["SILO-45", 200],
    ["SILO-32", 300],
    ["SILO-61", 100],
  ]);
  const cards = reviewCards(tickets, lastEventAt);
  expect(cards.map((c) => c.pr.number)).toEqual([22, 20, 23]);
  expect(cards.map((c) => c.feature)).toEqual([{ shortKey: "F5" }, { shortKey: "F4" }, null]);
  expect(cards[0]?.ticket.id).toBe("SILO-32");
  expect(reviewCards(tickets, new Map()).map((c) => c.pr.number)).toEqual([20, 22, 23]);
});
