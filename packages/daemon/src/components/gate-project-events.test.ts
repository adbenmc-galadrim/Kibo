import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { addBinding, createProjectDoc, createTicket, upsertExternalRef } from "@kibo/core";
import {
  type GrantedPermissions,
  type Instance,
  NO_ACTIVITY,
  type ProjectEventInput,
  type ProjectMeta,
} from "@kibo/schema";
import { createEventStore } from "../events/store";
import { createEventLog } from "./events";
import { createGate } from "./gate";
import { createGateHandlers } from "./gate-handlers";
import { eventsDb, idleHandlers, refused, stubDocs, stubHandlerDeps } from "./gate-test-kit";
import { createQuotas } from "./quotas";

const event = (featureId: string | null, number: number): ProjectEventInput => ({
  kind: "pr_opened",
  ticketId: null,
  featureId,
  source: "git",
  data: { number },
});

function journal() {
  const store = createEventStore(new Database(":memory:"), () => 7);
  store.append("p1", event("f1", 18));
  store.append("p1", event("f2", 20));
  store.append("p2", event("f1", 22));
  return store;
}

const numbers = (items: unknown) =>
  Array.isArray(items) ? items.map((e: { data: { number: number } }) => e.data.number) : null;

test("a component lists the journal of its project, newest first, filtered by its feature", async () => {
  const store = journal();
  const h = createGateHandlers({ ...stubHandlerDeps, projectEvents: (input) => store.list(input) });
  expect(numbers(await h.list("p1", "project_event"))).toEqual([20, 18]);
  expect(numbers(await h.list("p1", "project_event", { featureId: "f1" }))).toEqual([18]);
  expect(numbers(await h.list("p1", "project_event", { featureId: 3 }))).toEqual([20, 18]);
});

test("without the journal started, listing it fails with a stable code", async () => {
  const h = createGateHandlers(stubHandlerDeps);
  await expect(h.list("p1", "project_event")).rejects.toThrow("NOT_CONNECTED");
});

const READER: GrantedPermissions = {
  reads: ["project_event"],
  writes: [],
  data: false,
  net: [],
  secrets: [],
  mcp: [],
  capabilities: [],
};
const FEATURE_CARD: Instance = {
  id: "card",
  pageId: "pg",
  component: "journal@1.0.0",
  layout: { x: 0, y: 0, w: 6, h: 4 },
  config: { featureId: "f1" },
  componentHash: null,
};

test("the gate gives the instance config to the journal and never lets a reader write", async () => {
  const configs: unknown[] = [];
  const gate = createGate({
    instance: () => FEATURE_CARD,
    active: (ref) => ({ ref, trust: "sandboxed", granted: READER }),
    handlers: {
      ...idleHandlers,
      list: async (_projectId, entity, config) => {
        configs.push([entity, config]);
        return [];
      },
    },
    quotas: createQuotas(),
    events: createEventLog(eventsDb(), () => 1),
  });
  await gate.call("p1", "card", { kind: "list", entity: "project_event" });
  expect(configs).toEqual([["project_event", { featureId: "f1" }]]);
  await refused(gate.call("p1", "card", { kind: "list", entity: "ticket" }), "PERMISSION_DENIED");
  await refused(
    gate.call("p1", "card", { kind: "run", command: { method: "createTicket", title: "Écrit" } }),
    "PERMISSION_DENIED",
  );
});

const META: ProjectMeta = {
  id: "p1",
  key: "EMIS",
  name: "Emis",
  folder: null,
  color: "#14B8A6",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: "Suivi de chantier",
};

function projectHandlers(withPr: boolean, withBinding: boolean) {
  const project = createProjectDoc(META);
  const ticket = createTicket(project, { title: "Envoi", statusId: "in_review" });
  if (withPr)
    upsertExternalRef(project, ticket.id, {
      kind: "github_pr",
      url: "https://github.com/galadrimteam/emis/pull/22",
      number: 22,
      state: "open",
      base: "dev",
      head: null,
      review: "none",
      checks: null,
    });
  if (withBinding)
    addBinding(project, {
      id: "b1",
      adapter: "github-issues",
      config: { repo: "galadrimteam/emis-board", project: null, importClosed: false, labels: [] },
      createdBy: "adam",
      runner: "adam",
    });
  return createGateHandlers({
    ...stubHandlerDeps,
    docs: { ...stubDocs, project: () => project, activity: () => NO_ACTIVITY, today: () => "2026-10-16" },
  });
}

test("project.get names the repository of the GitHub binding first, then of a PR, else none", async () => {
  expect(await projectHandlers(true, true).project("p1")).toMatchObject({
    description: "Suivi de chantier",
    repo: "galadrimteam/emis-board",
  });
  expect((await projectHandlers(true, false).project("p1")).repo).toBe("galadrimteam/emis");
  expect((await projectHandlers(false, false).project("p1")).repo).toBeNull();
});
