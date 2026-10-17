import { afterEach, beforeEach, expect, test } from "bun:test";
import { readProject } from "@kibo/core";
import type { ProjectCommand } from "@kibo/schema";
import { type CommandEvent, USER_COMMAND } from "../docs";
import { type EventsHarness, eventsHarness, PR_18, seedFeature, tick } from "./events.test-helper";
import { createEventRecorder } from "./recorder";
import type { EventStore } from "./store";

let h: EventsHarness;
beforeEach(() => {
  h = eventsHarness();
});
afterEach(() => h.close());

const MERGED = { ...PR_18, state: "merged" as const, checks: "ok" as const };
const delivered = () => h.journal().filter((e) => e.data.delivered !== undefined);

function inReview() {
  const ids = seedFeature(h);
  h.run({ method: "setStatus", ticketId: ids.step, statusId: "in_review" });
  h.run({ method: "upsertExternalRef", ticketId: ids.step, ref: PR_18 });
  return { ...ids, before: h.journal().length };
}

test("the rule batch of a merge drops only the merged ticket, the root change stays", async () => {
  const { root, step, before } = inReview();
  h.run({ method: "upsertExternalRef", ticketId: step, ref: MERGED });
  h.service.triggerRules(h.project.id, { kind: "pr_merged", ticketId: step });
  await tick();
  expect(h.journal().slice(before)).toMatchObject([
    { kind: "pr_merged", ticketId: step, featureId: root, data: { number: 18, delivered: "F3" } },
    { kind: "status_changed", ticketId: root, data: { to: "done" } },
  ]);
  expect(delivered()).toHaveLength(1);
});

test("a manual status on the merged ticket after the merge is a normal status change", async () => {
  const { step, before } = inReview();
  h.run({ method: "upsertExternalRef", ticketId: step, ref: MERGED });
  await tick();
  h.run({ method: "setStatus", ticketId: step, statusId: "done" });
  const written = h.journal().slice(before);
  expect(written.map((e) => [e.kind, e.ticketId])).toEqual([
    ["pr_merged", step],
    ["status_changed", step],
    ["status_changed", written[2]?.ticketId ?? null],
  ]);
  expect(written[0]?.data.delivered).toBeUndefined();
  expect(written[1]?.data).toMatchObject({ to: "done", delivered: "F3" });
});

test("a next batch that is not only statuses writes the merge as is, then itself, at once", () => {
  const { step, before } = inReview();
  h.run({ method: "upsertExternalRef", ticketId: step, ref: MERGED });
  h.run({ method: "createSprint", code: "S43", name: "Clôture", start: "2026-10-19", end: "2026-10-23" });
  expect(
    h
      .journal()
      .slice(before)
      .map((e) => e.kind),
  ).toEqual(["pr_merged", "sprint_created"]);
});

test("a rule without effect on a done ticket leaves one merge line, without delivery", async () => {
  const { step } = inReview();
  h.run({ method: "setStatus", ticketId: step, statusId: "done" });
  const before = h.journal().length;
  h.run({ method: "upsertExternalRef", ticketId: step, ref: MERGED });
  h.service.triggerRules(h.project.id, { kind: "pr_merged", ticketId: step });
  await tick();
  const written = h.journal().slice(before);
  expect(written.map((e) => e.kind)).toEqual(["pr_merged"]);
  expect(written[0]?.data.delivered).toBeUndefined();
});

function manualRecorder(store: EventStore, log: (what: string, e: unknown) => void = () => {}) {
  h.events.stop();
  const docs = h.service.docs;
  const projectId = h.project.id;
  const recorder = createEventRecorder({
    store,
    snapshot: (id) => readProject(docs.project(id), docs.today(), docs.activity(id)),
    emit: () => {},
    log,
  });
  const batch = (commands: ProjectCommand[]) => {
    recorder.beforeCommand(projectId, docs.project(projectId), commands[0]?.method ?? "setStatus");
    const done: CommandEvent[] = commands.map((command) => ({
      projectId,
      command,
      result: h.run(command),
      meta: USER_COMMAND,
    }));
    recorder.afterCommands(projectId, done);
  };
  return batch;
}

test("two merges held together are both written, the feature delivered once", async () => {
  const { root, step } = inReview();
  const other = h.ticket("Reçu", root);
  const PR_19 = { ...PR_18, url: "https://github.com/galadrimteam/emis/pull/19", number: 19 };
  h.run({ method: "setStatus", ticketId: other, statusId: "in_review" });
  h.run({ method: "upsertExternalRef", ticketId: other, ref: PR_19 });
  const before = h.journal().length;
  const batch = manualRecorder(h.events.store);
  batch([
    { method: "upsertExternalRef", ticketId: step, ref: MERGED },
    { method: "upsertExternalRef", ticketId: other, ref: { ...PR_19, state: "merged" } },
  ]);
  batch([
    { method: "setStatus", ticketId: step, statusId: "done" },
    { method: "setStatus", ticketId: other, statusId: "done" },
  ]);
  await tick();
  const written = h.journal().slice(before);
  expect(written.map((e) => [e.kind, e.data.number])).toEqual([
    ["pr_merged", 18],
    ["pr_merged", 19],
  ]);
  expect(written.filter((e) => e.data.delivered === "F3")).toHaveLength(1);
});

test("a failing write of a held merge is logged, never thrown", async () => {
  const { step } = inReview();
  const logged: string[] = [];
  let failing = false;
  const store: EventStore = {
    ...h.events.store,
    append(projectId, input) {
      if (failing) throw new Error("disk full");
      return h.events.store.append(projectId, input);
    },
  };
  const batch = manualRecorder(store, (what) => logged.push(what));
  batch([{ method: "upsertExternalRef", ticketId: step, ref: MERGED }]);
  failing = true;
  await tick();
  expect(logged).toHaveLength(1);
  expect(h.journal().some((e) => e.kind === "pr_merged")).toBe(false);
});
