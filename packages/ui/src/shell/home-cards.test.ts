import { expect, test } from "bun:test";
import { overviewIndicators } from "@kibo/schema";
import { homeCard } from "./home-cards";
import { HOME_TODAY, question, siloHomeSnapshot, summaryOf } from "./home-fixtures";

const snapshot = siloHomeSnapshot();
const project = summaryOf(snapshot);

test("homeCard gives the key, the client and the counts of the project", () => {
  expect(homeCard(project, snapshot, HOME_TODAY)).toEqual({
    id: "silo",
    key: "SILO",
    name: "Silo",
    color: "#14B8A6",
    client: "Silo SA",
    counts: { open: 7, blocked: 5, late: 1, risk: 0, sprint: "S42", done: 1, total: 8 },
  });
});

test("homeCard never exposes the folder of the project", () => {
  const card = homeCard(project, snapshot, HOME_TODAY);
  expect(JSON.stringify(card)).not.toContain("/Users/");
});

test("homeCard counts like the overview of the project", () => {
  const indicators = overviewIndicators({ snapshot, today: HOME_TODAY });
  const card = homeCard(project, snapshot, HOME_TODAY);
  expect(card.counts?.blocked).toBe(indicators.blocked.count);
  expect(card.counts?.late).toBe(indicators.features.late);
});

test("an archived blocking question no longer blocks its ticket", () => {
  const answered = {
    ...snapshot,
    questions: snapshot.questions.map((q) => (q.id === "q14" ? { ...q, archivedAt: 1 } : q)),
  };
  expect(homeCard(project, answered, HOME_TODAY).counts?.blocked).toBe(4);
  const extra = { ...snapshot, questions: [...snapshot.questions, question({ id: "q15", ticketId: "s1" })] };
  expect(homeCard(project, extra, HOME_TODAY).counts?.blocked).toBe(5);
});

test("homeCard follows the current sprint of the day", () => {
  expect(homeCard(project, snapshot, "2026-10-19").counts?.sprint).toBe("S43");
  expect(homeCard(project, { ...snapshot, sprints: [] }, HOME_TODAY).counts?.sprint).toBeNull();
});

test("homeCard reads the live project and waits for its snapshot to count", () => {
  const renamed = { ...snapshot, meta: { ...snapshot.meta, client: null, name: "Silo 2" } };
  expect(homeCard(project, renamed, HOME_TODAY)).toMatchObject({ name: "Silo 2", client: null });
  expect(homeCard(project, undefined, HOME_TODAY)).toMatchObject({ client: "Silo SA", counts: null });
});

test("during its sprint a feature is at risk, after its end it is late, like the overview", () => {
  expect(homeCard(project, snapshot, "2026-10-16").counts).toMatchObject({ late: 0, risk: 1 });
  expect(homeCard(project, snapshot, HOME_TODAY).counts).toMatchObject({ late: 1, risk: 0 });
});

test("the steps on hold do not put their feature at risk", () => {
  const hold = { source: "own" as const, key: "SILO-1", reason: "Accès VPN du client", since: "2026-10-16" };
  const held = {
    ...snapshot,
    tickets: snapshot.tickets.map((t) =>
      t.parentId === "f5" && t.statusId !== "done" ? { ...t, onHold: hold } : t,
    ),
  };
  expect(homeCard(project, held, "2026-10-16").counts?.risk).toBe(0);
});
