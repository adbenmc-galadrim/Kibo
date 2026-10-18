import { beforeAll, expect, test } from "bun:test";
import { deadlineRows } from "../../packages/schema/src/deadline-rows";
import { featureSteps } from "../../packages/schema/src/feature-steps";
import { DEFAULT_SESSION_TOOL, type ProjectSnapshot, type TicketView } from "../../packages/schema/src/index";
import { nextDeliverableStep } from "../../packages/schema/src/next-step";
import { overviewIndicators, reviewCards } from "../../packages/schema/src/overview";
import { verifySiloJournal } from "../seed-silo-journal";
import { seedSiloMaquettes } from "../seed-silo-maquettes";
import { scenarioTurns } from "./memory-agent";
import { createMemoryDaemon, type MemoryDaemon, memorySeed } from "./memory-daemon";
import { SILO_PROJECT, siloKey } from "./silo-maquettes";
import { SILO_BATCH, SILO_CLOSING, SILO_DAY_SUMMARY, SILO_LAST_FACTS, SILO_SESSIONS } from "./silo-suivi";

const TODAY = "2026-10-16";

let daemon: MemoryDaemon;
let today: ProjectSnapshot;
let projectId: string;

beforeAll(async () => {
  daemon = createMemoryDaemon("adam", TODAY);
  projectId = (await seedSiloMaquettes(daemon.rpc, memorySeed(daemon))).projectId;
  today = daemon.snapshot(SILO_PROJECT.key, TODAY);
});

const byKey = (key: string): TicketView => {
  const found = today.tickets.find((t) => t.key === key || t.shortKey === key);
  if (found === undefined) throw new Error(`${key} is missing`);
  return found;
};
const keyOf = (id: string | null): string | null => today.tickets.find((t) => t.id === id)?.key ?? null;
const stepsOf = (shortKey: string) => featureSteps({ feature: byKey(shortKey).id, ...today });
const blockingQuestions = (): Map<string, string> =>
  new Map(today.questions.flatMap((q) => (q.blocking && q.importRef ? [[q.ticketId, q.importRef.id]] : [])));

test("two T3 Code sessions on SILO-33 and SILO-45, both still open", () => {
  expect(SILO_SESSIONS.map((s) => [siloKey(s.n), s.tool])).toEqual([
    ["SILO-33", DEFAULT_SESSION_TOOL],
    ["SILO-45", DEFAULT_SESSION_TOOL],
  ]);
  expect(SILO_SESSIONS.map((s) => byKey(siloKey(s.n)).statusId)).toEqual(["in_progress", "in_review"]);
});

test("one agent turn proposes seven batches: six superseded, the seventh pending with three actions", () => {
  const { batches } = daemon.agentView(projectId);
  expect(batches.map((b) => [b.seq, b.status])).toEqual([
    [1, "superseded"],
    [2, "superseded"],
    [3, "superseded"],
    [4, "superseded"],
    [5, "superseded"],
    [6, "superseded"],
    [7, "pending"],
  ]);
  const q14 = today.questions.find((q) => q.importRef?.id === "Q14")?.id;
  const expected = SILO_BATCH.actions.map((a) =>
    a.type === "remindQuestion" ? { id: a.id, type: a.type, why: a.why, questionId: q14 } : a,
  );
  expect(batches.at(-1)).toMatchObject({
    seq: SILO_BATCH.seq,
    summary: SILO_BATCH.summary,
    actions: expected,
  });
  expect(scenarioTurns()[0]?.result).toBe(SILO_DAY_SUMMARY);
});

test("the last facts are #18 merged with F3 delivered, batch 7, step 7 of SILO-33 and the opening of #22", async () => {
  const last = daemon
    .events()
    .slice(-4)
    .map((e) => [e.kind, keyOf(e.ticketId), e.data]);
  expect(last).toEqual(SILO_LAST_FACTS.map((f) => [f.kind, f.key, f.data]));
  await verifySiloJournal(daemon.rpc, projectId);
});

test("the poller merge closes SILO-21 and delivers F3", () => {
  expect(byKey("SILO-21").statusId).toBe("done");
  expect(byKey("F3").statusId).toBe("done");
  expect(byKey("F3").feature?.status).toBe("delivered");
});

test("the T3 Code sessions start before the closing facts", () => {
  const events = daemon.events();
  const sessions = events.flatMap((e, at) => (e.kind === "session_started" ? [[keyOf(e.ticketId), at]] : []));
  expect(sessions.map(([key]) => key)).toEqual(SILO_SESSIONS.map((s) => siloKey(s.n)));
  const merge = events.findIndex((e) => e.kind === "pr_merged" && e.data.number === SILO_CLOSING.merged);
  expect(sessions.every(([, at]) => typeof at === "number" && at < merge)).toBe(true);
});

test("the indicators of P1 bis", () => {
  const indicators = overviewIndicators({ snapshot: today, today: TODAY });
  expect(indicators.features).toMatchObject({ delivered: 3, total: 9 });
  expect(indicators.sprint).toEqual({ code: "S42", name: "Saisie hors ligne", ending: "today" });
  expect(indicators.open).toEqual({ count: 2, limit: 2, level: "reached" });
  expect(indicators.review).toEqual({ count: 3, numbers: [20, 22, 23] });
  expect(indicators.questions).toEqual({ open: 3, blocking: { ref: "Q14", shortKey: "F6" } });
});

test("deadlines: F4, F5, F6, F8, F7, F5 slips to S43 and F6 waits on Q14", () => {
  const features = today.tickets.flatMap((t, rank) =>
    t.feature === null || t.sprintId === null || t.shortKey === null
      ? []
      : [
          {
            id: t.id,
            shortKey: t.shortKey,
            title: t.title,
            sprintId: t.sprintId,
            rank,
            state: t.feature,
            steps: stepsOf(t.shortKey),
          },
        ],
  );
  const rows = deadlineRows({
    sprints: today.sprints,
    features,
    blockingQuestions: blockingQuestions(),
    today: TODAY,
  });
  expect(rows.map((r) => [r.shortKey, r.slipTo?.code ?? null, r.blockedBy])).toEqual([
    ["F4", null, null],
    ["F5", "S43", null],
    ["F6", null, "Q14"],
    ["F8", null, null],
    ["F7", null, null],
  ]);
  expect(rows[1]?.cells.filter((c) => c.slipped)).toHaveLength(4);
});

test("the next step to deliver is SILO-45 for F4 and SILO-34 for F5", () => {
  expect(keyOf(nextDeliverableStep(stepsOf("F4")))).toBe("SILO-45");
  expect(keyOf(nextDeliverableStep(stepsOf("F5")))).toBe("SILO-34");
});

test("pull requests in review follow their last pull request fact: #22, #20, #23", () => {
  const lastEventAt = new Map(
    daemon
      .events()
      .flatMap((e, at) =>
        e.ticketId === null || !e.kind.startsWith("pr_") ? [] : [[e.ticketId, at] as const],
      ),
  );
  expect(reviewCards(today.tickets, lastEventAt).map((c) => c.pr.number)).toEqual([22, 20, 23]);
});
