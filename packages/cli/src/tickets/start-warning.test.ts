import { describe, expect, test } from "bun:test";
import type { FeatureState, Question, TicketView } from "@kibo/schema";
import { fakeSnapshot, fakeTicket, SPRINTS } from "../commands/tickets-test-kit";
import { notStartableReasons } from "./start-warning";

const STARTED: FeatureState = {
  status: "open",
  steps: { done: 1, total: 2, mandatoryDone: 1, mandatoryTotal: 2 },
  nextStepId: null,
  remaining: 1,
  started: true,
};
const NOT_STARTED: FeatureState = { ...STARTED, status: "todo", started: false };

const feature = (id: string, sprintId: string | undefined, state: FeatureState): TicketView => ({
  ...fakeTicket({ id, key: `EMIS-${id}`, shortKey: id.toUpperCase(), sprintId, children: 1 }),
  feature: state,
});

const question = (ticketId: string, number: number, patch: Partial<Question> = {}): Question => ({
  id: `q${number}`,
  ticketId,
  runId: null,
  title: "Format ?",
  context: "",
  options: [],
  provisional: null,
  blocking: true,
  createdBy: { kind: "human", ref: "u-me" },
  createdAt: 0,
  number,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  kind: "question",
  images: [],
  ...patch,
});

const step = (patch: Partial<TicketView>): TicketView => ({
  ...fakeTicket({ id: "s51", key: "EMIS-51", parentId: "f6", effectiveSprintId: "s43" }),
  startable: false,
  ...patch,
});

const FEATURES = [
  feature("f4", "s42", STARTED),
  feature("f5", "s42", STARTED),
  feature("f7", "s42", STARTED),
  feature("f6", "s43", NOT_STARTED),
];

const reasonsOf = (ticket: TicketView, questions: Question[] = [], tickets = FEATURES) =>
  notStartableReasons(
    ticket,
    fakeSnapshot([...tickets, ticket], SPRINTS, { questions, meta: { tracking: { openLimit: 2 } } }),
  );

describe("notStartableReasons", () => {
  test("gives every reason at once: question, sprint to come, limit with its count", () => {
    const ticket = step({ startReason: { kind: "question", label: "Q14" } });
    expect(reasonsOf(ticket, [question("s51", 14)])).toEqual(["bloqué par Q14", "sprint S43", "limite 3/2"]);
  });

  test("names the steps it waits on and the blocked status", () => {
    const ticket = step({
      statusId: "blocked",
      waitingOn: ["EMIS-33", "EMIS-34"],
      effectiveSprintId: "s42",
      parentId: "f5",
      startReason: { kind: "status" },
    });
    expect(reasonsOf(ticket)).toEqual(["bloqué", "attend EMIS-33, EMIS-34"]);
  });

  test("says a feature without sprint is unplanned when the project has sprints", () => {
    const ticket = step({ parentId: "fx", effectiveSprintId: null, startReason: { kind: "unplanned" } });
    expect(reasonsOf(ticket, [], [...FEATURES, feature("fx", undefined, STARTED)])).toEqual(["sans sprint"]);
  });

  test("falls back on the reason the daemon gave", () => {
    const ticket = step({
      parentId: null,
      effectiveSprintId: null,
      startReason: { kind: "sprint", code: "S9" },
    });
    expect(reasonsOf(ticket)).toEqual(["sprint S9"]);
  });

  test("stays silent for a startable step, a step already started and an unexplained refusal", () => {
    expect(reasonsOf(step({ startable: true }))).toBeNull();
    expect(reasonsOf(step({ statusId: "in_progress", startReason: { kind: "status" } }))).toBeNull();
    const busy = step({ parentId: "f5", effectiveSprintId: "s42", startReason: { kind: "status" } });
    expect(reasonsOf(busy)).toBeNull();
  });

  test("ignores an answered or non-blocking question", () => {
    const ticket = step({ parentId: "f5", effectiveSprintId: "s42", startReason: null });
    const answer: Question["answer"] = {
      kind: "text",
      option: null,
      text: "oui",
      by: { kind: "human", ref: "u" },
      at: 1,
      deliveredAt: null,
      deliveredRunId: null,
    };
    const done = [question("s51", 14, { answer }), question("s51", 15, { blocking: false })];
    expect(reasonsOf(ticket, done)).toBeNull();
  });
});
