import { beforeAll, expect, test } from "bun:test";
import { deadlineRows } from "../../packages/schema/src/deadline-rows";
import { featureSteps } from "../../packages/schema/src/feature-steps";
import { DEFAULT_SESSION_TOOL, type ProjectSnapshot, type TicketView } from "../../packages/schema/src/index";
import { nextDeliverableStep } from "../../packages/schema/src/next-step";
import { overviewIndicators, reviewCards } from "../../packages/schema/src/overview";
import { seedEmisMaquettes } from "../seed-emis-maquettes";
import { EMIS_PROJECT, emisKey } from "./emis-maquettes";
import { EMIS_BATCH, EMIS_CLOSING, EMIS_DAY_SUMMARY, EMIS_SESSIONS } from "./emis-suivi";
import { scenarioTurns } from "./memory-agent";
import { createMemoryDaemon, type MemoryDaemon } from "./memory-daemon";

const TODAY = "2026-10-16";

let daemon: MemoryDaemon;
let today: ProjectSnapshot;
let projectId: string;

beforeAll(async () => {
  daemon = createMemoryDaemon("adam", TODAY);
  projectId = (await seedEmisMaquettes(daemon.rpc)).projectId;
  today = daemon.snapshot(EMIS_PROJECT.key, TODAY);
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

test("two T3 Code sessions on EMIS-33 and EMIS-45, both still open", () => {
  expect(EMIS_SESSIONS.map((s) => [emisKey(s.n), s.tool])).toEqual([
    ["EMIS-33", DEFAULT_SESSION_TOOL],
    ["EMIS-45", DEFAULT_SESSION_TOOL],
  ]);
  expect(EMIS_SESSIONS.map((s) => byKey(emisKey(s.n)).statusId)).toEqual(["in_progress", "in_review"]);
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
  const expected = EMIS_BATCH.actions.map((a) =>
    a.type === "remindQuestion" ? { id: a.id, type: a.type, why: a.why, questionId: q14 } : a,
  );
  expect(batches.at(-1)).toMatchObject({
    seq: EMIS_BATCH.seq,
    summary: EMIS_BATCH.summary,
    actions: expected,
  });
  expect(scenarioTurns()[0]?.result).toBe(EMIS_DAY_SUMMARY);
});

test("the last facts are the merge of #18, batch 7, step 7 of EMIS-33 and the opening of #22", () => {
  const last = daemon
    .events()
    .slice(-4)
    .map((e) => [e.kind, keyOf(e.ticketId), e.detail]);
  expect(last).toEqual([
    ["pr_merged", "EMIS-21", EMIS_CLOSING.merged],
    ["batch_proposed", null, EMIS_BATCH.seq],
    ["step_set", "EMIS-33", 7],
    ["pr_opened", "EMIS-32", EMIS_CLOSING.opened],
  ]);
});

test("the indicators of P1 bis", () => {
  const indicators = overviewIndicators({ snapshot: today, today: TODAY });
  expect(indicators.features).toMatchObject({ delivered: 3, total: 9 });
  expect(indicators.sprint).toEqual({ code: "S42", name: "Terrain hors ligne", ending: "today" });
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

test("the next step to deliver is EMIS-45 for F4 and EMIS-34 for F5", () => {
  expect(keyOf(nextDeliverableStep(stepsOf("F4")))).toBe("EMIS-45");
  expect(keyOf(nextDeliverableStep(stepsOf("F5")))).toBe("EMIS-34");
});

test("pull requests in review follow the order of the commands: #22, #20, #23", () => {
  const lastEventAt = new Map(
    daemon.events().flatMap((e, at) => (e.ticketId === null ? [] : [[e.ticketId, at] as const])),
  );
  expect(reviewCards(today.tickets, lastEventAt).map((c) => c.pr.number)).toEqual([22, 20, 23]);
});
