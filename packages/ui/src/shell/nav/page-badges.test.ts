import { expect, test } from "bun:test";
import type { Instance, ProjectSnapshot, Question, SprintView, TicketView } from "@kibo/schema";
import { kiboProject } from "../../lib/fixtures";
import { pageBadge } from "./page-badges";

const instance = (pageId: string, component: string): Instance => ({
  id: `i-${pageId}`,
  pageId,
  component,
  layout: { x: 0, y: 0, w: 12, h: 8 },
  config: {},
  componentHash: null,
});

const sprint = (id: string, code: string, state: SprintView["state"], start: string): SprintView => ({
  id,
  code,
  name: `Sprint ${code}`,
  start,
  end: start,
  state,
  features: [],
  delivered: 0,
  total: 0,
  lingering: false,
});

const question = (id: string, answered: boolean): Question => ({
  kind: "question",
  id,
  ticketId: "t12",
  images: [],
  runId: null,
  title: `Question ${id}`,
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus" },
  createdAt: 0,
  number: null,
  importRef: null,
  answer: answered
    ? {
        kind: "text",
        option: null,
        text: "oui",
        by: { kind: "human", ref: "adam" },
        at: 1,
        deliveredAt: null,
        deliveredRunId: null,
      }
    : null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
});

function project(over: Partial<ProjectSnapshot>): ProjectSnapshot {
  const base = kiboProject();
  return {
    ...base,
    instances: [
      instance("p-plan", "planning@1.0.0"),
      instance("p-tickets", "tickets@1.0.0"),
      instance("p-questions", "questions@1.0.0"),
      instance("p-kanban", "kanban@1.0.0"),
    ],
    ...over,
  };
}

test("the Planning page shows the current sprint", () => {
  const p = project({
    sprints: [
      sprint("s41", "S41", "done", "2026-10-05"),
      sprint("s42", "S42", "current", "2026-10-12"),
      sprint("s43", "S43", "planned", "2026-10-19"),
    ],
  });
  expect(pageBadge("p-plan", p)).toBe("S42");
  expect(
    pageBadge("p-plan", project({ sprints: [sprint("s43", "S43", "planned", "2026-10-19")] })),
  ).toBeNull();
});

test("the Tickets page counts the open tickets that are not features", () => {
  const base = kiboProject();
  const first = base.tickets[0];
  if (!first) throw new Error("expected a ticket");
  const feature: TicketView = { ...first, id: "f1", progress: { done: 0, total: 2 } };
  const p = project({ tickets: [...base.tickets, feature] });
  expect(pageBadge("p-tickets", p)).toBe("3");
});

test("the Questions page counts the open questions", () => {
  const p = project({ questions: [question("q1", false), question("q2", true), question("q3", false)] });
  expect(pageBadge("p-questions", p)).toBe("2");
  expect(pageBadge("p-questions", project({ questions: [] }))).toBeNull();
});

test("other pages have no badge", () => {
  expect(pageBadge("p-kanban", project({}))).toBeNull();
  expect(pageBadge("missing", project({}))).toBeNull();
});
