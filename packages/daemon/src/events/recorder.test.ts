import { afterEach, beforeEach, expect, test } from "bun:test";
import type { GithubPrRef, Sprint } from "@kibo/schema";
import { KIBO_COMMAND } from "../docs";
import { type EventsHarness, eventsHarness } from "./events.test-helper";

let h: EventsHarness;
beforeEach(() => {
  h = eventsHarness();
});
afterEach(() => h.close());

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const kinds = () => h.journal().map((e) => e.kind);
const last = () => h.journal().at(-1);
const PR: GithubPrRef = {
  kind: "github_pr",
  url: "https://github.com/galadrimteam/emis/pull/18",
  number: 18,
  state: "open",
  base: "dev",
  head: "feat/f3",
  review: "none",
  checks: "running",
};

const BRANCH = { kind: "git_branch" as const, branch: "feat/f3", base: "dev" };

function feature() {
  const root = h.ticket("Synchronisation");
  h.run({ method: "updateTicket", ticketId: root, shortKey: "F3" });
  const done = h.ticket("Schéma", root);
  const step = h.ticket("Envoi", root);
  const demo = h.ticket("Démo", root);
  h.run({ method: "setTicketOptional", ticketId: demo, optional: true });
  h.run({ method: "setStatus", ticketId: done, statusId: "done" });
  return { root, step, demo };
}

test("a status change is one event, with its root and its origin, a repeated status none", () => {
  const { root, step } = feature();
  const before = h.journal().length;
  h.run({ method: "setStatus", ticketId: step, statusId: "in_progress" });
  h.run({ method: "setStatus", ticketId: step, statusId: "in_progress" });
  h.run({ method: "setStatus", ticketId: step, statusId: "in_review" }, KIBO_COMMAND);
  expect(h.journal().slice(before)).toMatchObject([
    {
      kind: "status_changed",
      ticketId: step,
      featureId: root,
      source: "user",
      data: { from: "todo", to: "in_progress" },
    },
    {
      kind: "status_changed",
      ticketId: step,
      featureId: root,
      source: "kibo",
      data: { from: "in_progress", to: "in_review" },
    },
  ]);
});

test("a sprint created and a ticket moved between sprints name the codes before and after", () => {
  const { root } = feature();
  const s42 = h.run({
    method: "createSprint",
    code: "S42",
    name: "Terrain",
    start: "2026-10-12",
    end: "2026-10-16",
  });
  const s43 = h.run({
    method: "createSprint",
    code: "S43",
    name: "Clôture",
    start: "2026-10-19",
    end: "2026-10-23",
  });
  h.run({ method: "setTicketSprint", ticketId: root, sprintId: (s42 as Sprint).id });
  h.run({ method: "setTicketSprint", ticketId: root, sprintId: (s43 as Sprint).id });
  h.run({ method: "setTicketSprint", ticketId: root, sprintId: (s43 as Sprint).id });
  expect(h.journal().filter((e) => e.kind.startsWith("sprint_"))).toMatchObject([
    { kind: "sprint_created", ticketId: null, featureId: null, data: { code: "S42", name: "Terrain" } },
    { kind: "sprint_created", data: { code: "S43" } },
    { kind: "sprint_set", ticketId: root, featureId: root, source: "user", data: { from: null, to: "S42" } },
    { kind: "sprint_set", data: { from: "S42", to: "S43" } },
  ]);
});

test("a PR is opened, reviewed and checked in separate events, an identical PR none", () => {
  const { root, step } = feature();
  h.run({ method: "upsertExternalRef", ticketId: step, ref: BRANCH });
  h.run({ method: "upsertExternalRef", ticketId: step, ref: BRANCH });
  h.run({ method: "upsertExternalRef", ticketId: step, ref: PR });
  h.run({ method: "upsertExternalRef", ticketId: step, ref: { ...PR, review: "changes_requested" } });
  h.run({
    method: "upsertExternalRef",
    ticketId: step,
    ref: { ...PR, review: "changes_requested", checks: "error" },
  });
  h.run({
    method: "upsertExternalRef",
    ticketId: step,
    ref: { ...PR, review: "changes_requested", checks: "error" },
  });
  const git = h.journal().filter((e) => e.source === "git");
  expect(git.map((e) => e.kind)).toEqual(["branch_created", "pr_opened", "pr_review", "pr_checks"]);
  expect(git[0]).toMatchObject({ ticketId: step, featureId: root, data: { branch: "feat/f3" } });
  expect(git[3]?.data).toEqual({ number: 18, state: "open", review: "changes_requested", checks: "error" });
});

test("a delivery step is recorded by its kind, a retouch as update-delivery", () => {
  const { step } = feature();
  const delivery = { step: 7, note: "Porte qualité", at: 5, runId: null };
  h.run(
    { method: "setTicketDelivery", ticketId: step, delivery: { ...delivery, kind: "delivery" } },
    KIBO_COMMAND,
  );
  h.run(
    { method: "setTicketDelivery", ticketId: step, delivery: { ...delivery, step: 2, kind: "update" } },
    KIBO_COMMAND,
  );
  h.run({ method: "setTicketDelivery", ticketId: step, delivery: null }, KIBO_COMMAND);
  expect(h.journal().filter((e) => e.kind === "step_set")).toMatchObject([
    { source: "full-delivery", data: { step: 7, note: "Porte qualité" } },
    { source: "update-delivery", data: { step: 2 } },
  ]);
});

test("a merge that delivers the last mandatory step is one line naming the feature", async () => {
  const { root, step } = feature();
  h.run({ method: "setStatus", ticketId: step, statusId: "in_review" });
  h.run({ method: "upsertExternalRef", ticketId: step, ref: PR });
  const before = h.journal().length;
  h.run({ method: "upsertExternalRef", ticketId: step, ref: { ...PR, state: "merged", checks: "ok" } });
  h.service.triggerRules(h.project.id, { kind: "pr_merged", ticketId: step });
  await tick();
  expect(h.journal().slice(before)).toMatchObject([
    { kind: "pr_merged", ticketId: step, featureId: root, data: { number: 18, delivered: "F3" } },
  ]);
});

test("a merge without a status change is recorded on its own, without delivery", async () => {
  const { step } = feature();
  h.run({ method: "upsertExternalRef", ticketId: step, ref: PR });
  h.changes.length = 0;
  h.run({ method: "upsertExternalRef", ticketId: step, ref: { ...PR, state: "merged" } });
  await tick();
  expect(last()).toMatchObject({ kind: "pr_merged", data: { number: 18 } });
  expect(last()?.data.delivered).toBeUndefined();
  expect(h.changes.filter((id) => id === h.project.id).length).toBeGreaterThanOrEqual(2);
  h.run({ method: "setStatus", ticketId: step, statusId: "done" });
  expect(h.journal().filter((e) => e.data.delivered !== undefined)).toMatchObject([
    { kind: "status_changed", ticketId: step, data: { to: "done", delivered: "F3" } },
  ]);
});

test("questions created and answered are recorded on their ticket", () => {
  const { root, step } = feature();
  const question = h.run({
    method: "createQuestion",
    ticketId: step,
    title: "Quel format d'export ?",
    createdBy: { kind: "human", ref: "adam" },
  }) as { id: string };
  h.run({
    method: "answerQuestion",
    questionId: question.id,
    answer: { kind: "text", text: "CSV" },
    by: { kind: "human", ref: "adam" },
  });
  expect(kinds().slice(-2)).toEqual(["question_created", "question_answered"]);
  expect(last()).toMatchObject({ ticketId: step, featureId: root, data: { questionId: question.id } });
});

test("a refused command records nothing and the next one compares with the right state", () => {
  const { step } = feature();
  const before = h.journal().length;
  expect(() => h.run({ method: "setStatus", ticketId: "missing", statusId: "done" })).toThrow();
  h.run({ method: "setStatus", ticketId: step, statusId: "in_progress" });
  expect(h.journal().slice(before)).toMatchObject([{ kind: "status_changed", data: { from: "todo" } }]);
});

test("the sink stamps an event with the clock and announces the change", () => {
  h.clock.now = 42_000;
  h.changes.length = 0;
  h.events.sink.record(h.project.id, {
    kind: "batch_proposed",
    ticketId: null,
    featureId: null,
    source: "project-agent",
    data: { seq: 7 },
  });
  expect(last()).toMatchObject({ kind: "batch_proposed", at: 42_000, data: { seq: 7 } });
  expect(h.changes).toEqual([h.project.id]);
  expect(() =>
    h.events.sink.record(h.project.id, {
      kind: "batch_proposed",
      ticketId: null,
      featureId: null,
      source: "project-agent",
      data: { text: "x".repeat(301) },
    }),
  ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
});

test("after stop, commands are no longer recorded", () => {
  h.events.stop();
  const before = h.journal().length;
  h.ticket("Seul");
  h.run({ method: "createSprint", code: "S44", name: "Fin", start: "2026-10-26", end: "2026-10-30" });
  expect(h.journal().length).toBe(before);
});
