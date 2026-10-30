import { expect, test } from "bun:test";
import { createProjectDoc, createSprint, createTicket, upsertExternalRef } from "@kibo/core";
import { type CiRun, DEFAULT_RECIPIENTS, NO_ACTIVITY, type ProjectMeta } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import { z } from "zod";
import type { FilesService } from "../files/service";
import type { ComponentIntegrationHooks } from "../integrations/types";
import { createGateHandlers } from "./gate-handlers";
import { stubDocs, stubFiles, stubHandlerDeps, unused } from "./gate-test-kit";

const fileCalls: unknown[] = [];
const files: FilesService = {
  ...stubFiles,
  list: async (projectId) => {
    fileCalls.push(["list", projectId]);
    return [];
  },
  url: async (projectId, instanceId, name) => {
    fileCalls.push(["url", projectId, instanceId, name]);
    return { url: "http://127.0.0.1:1/f/x/a.png", expiresAt: 1 };
  },
};
const ciRun: CiRun = {
  repo: "adam/kibo",
  runId: 1,
  prNumber: null,
  ticketKey: null,
  headSha: "abc",
  workflow: "ci",
  status: "completed",
  conclusion: "success",
  url: "https://github.com/adam/kibo/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-09-26T10:00:00Z",
  jobs: [],
};

function hooks(seen: unknown[]): ComponentIntegrationHooks {
  return {
    aliases: new Map(),
    observe: () => {},
    secret: async () => null,
    design: null,
    ciRuns: async (projectId) => {
      seen.push(["ci", projectId]);
      return [ciRun];
    },
  };
}

const handlersWith = (integrations: ComponentIntegrationHooks | null | undefined) =>
  createGateHandlers({
    ...stubHandlerDeps,
    files,
    ...(integrations !== undefined && { integrations: () => integrations }),
  });

test("without a ci poller the call fails with a stable code", async () => {
  for (const integrations of [undefined, null, { ...hooks([]), ciRuns: null }]) {
    const h = handlersWith(integrations);
    await expect(h.list("p", "ci_run")).rejects.toThrow("NOT_CONNECTED");
  }
});

test("ci runs are listed per project", async () => {
  const seen: unknown[] = [];
  expect(await handlersWith(hooks(seen)).list("p", "ci_run")).toEqual([ciRun]);
  expect(seen).toEqual([["ci", "p"]]);
});

test("a component lists busy tickets as not startable and sprints dated by the daemon", async () => {
  const project = createProjectDoc({
    id: "p",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
  const busy = createTicket(project, { title: "A", statusId: "todo" });
  createTicket(project, { title: "B", statusId: "todo" });
  createSprint(project, { code: "S42", name: "S42", start: "2026-10-12", end: "2026-10-16" });
  const handlers = createGateHandlers({
    ...stubHandlerDeps,
    docs: {
      ...stubDocs,
      project: () => project,
      activity: () => ({ ...NO_ACTIVITY, busyTickets: new Set([busy.id]) }),
      today: () => "2026-10-16",
    },
  });
  const Listed = z.array(z.object({ title: z.string(), startable: z.boolean() }));
  const tickets = Listed.parse(await handlers.list("p", "ticket"));
  expect(tickets.map((t) => [t.title, t.startable])).toEqual([
    ["A", false],
    ["B", true],
  ]);
  const Sprints = z.array(z.object({ name: z.string(), state: z.string() }));
  expect(Sprints.parse(await handlers.list("p", "sprint"))).toEqual([{ name: "S42", state: "current" }]);
});

test("the question recipients are read from the project, defaults included, without writing", async () => {
  const project = new LoroDoc();
  const h = createGateHandlers({ ...stubHandlerDeps, docs: { ...stubDocs, project: () => project } });
  expect(await h.recipients("p")).toEqual([...DEFAULT_RECIPIENTS]);
  expect(project.oplogVersion().length()).toBe(0);
});

test("project file calls reach the files service with the calling instance", async () => {
  const h = handlersWith(undefined);
  await h.assets("p", "i1", { kind: "assets.list" });
  await h.assets("p", "i1", { kind: "assets.url", name: "a.png" });
  expect(fileCalls).toEqual([
    ["list", "p"],
    ["url", "p", "i1", "a.png"],
  ]);
});

test("design frames reach the design gate with the calling instance, or fail when not started", async () => {
  const seen: unknown[] = [];
  const frame = { url: "https://www.figma.com/design/AbC123xyz/K?node-id=1-2", refresh: true };
  const h = handlersWith({
    ...hooks([]),
    design: {
      frame: async (ctx, url, refresh) => {
        seen.push([ctx.projectId, ctx.instanceId, url, refresh]);
        return unused();
      },
      storybooks: async (ctx) => {
        seen.push([ctx.projectId, ctx.instanceId, "storybooks"]);
        return [];
      },
    },
  });
  await expect(h.design("p", "i1", { kind: "design.frame", ...frame })).rejects.toThrow("unused");
  expect(await h.design("p", "i1", { kind: "design.storybooks" })).toEqual([]);
  expect(seen).toEqual([
    ["p", "i1", frame.url, true],
    ["p", "i1", "storybooks"],
  ]);
  for (const integrations of [undefined, null, hooks([])])
    await expect(
      handlersWith(integrations).design("p", "i1", { kind: "design.frame", ...frame }),
    ).rejects.toThrow("NOT_CONNECTED");
});

test("the gate has no handler to deliver answers to an agent", () => {
  expect("questions" in createGateHandlers(stubHandlerDeps)).toBe(false);
});

const metaWith = (tracking: ProjectMeta["tracking"]): ProjectMeta => ({
  id: "p1",
  key: "SILO",
  name: "Silo",
  folder: null,
  color: "#14B8A6",
  worktree: null,
  storybook: null,
  delivery: null,
  tracking,
  description: null,
  client: null,
});

test("settings.get reads the project tracking", async () => {
  const handlers = createGateHandlers({
    ...stubHandlerDeps,
    docs: { ...stubDocs, projectMeta: () => metaWith({ openLimit: 3 }) },
  });
  expect(await handlers.settings("p1")).toEqual({ tracking: { openLimit: 3 } });
  const defaults = createGateHandlers({
    ...stubHandlerDeps,
    docs: { ...stubDocs, projectMeta: () => metaWith(null) },
  });
  expect(await defaults.settings("p1")).toEqual({ tracking: null });
});

test("project.get names the project and the repository of its first pull request", async () => {
  const project = createProjectDoc({ ...metaWith(null), description: null });
  const ticket = createTicket(project, { title: "Envoi", statusId: "in_review" });
  upsertExternalRef(project, ticket.id, {
    kind: "github_pr",
    url: "https://github.com/silo-labs/silo-location/pull/22",
    number: 22,
    state: "open",
    base: "dev",
    head: null,
    review: "none",
    checks: null,
  });
  const h = createGateHandlers({
    ...stubHandlerDeps,
    docs: { ...stubDocs, project: () => project, activity: () => NO_ACTIVITY, today: () => "2026-10-16" },
  });
  expect(await h.project("p1")).toEqual({
    id: "p1",
    key: "SILO",
    name: "Silo",
    color: "#14B8A6",
    description: null,
    client: null,
    hasFolder: false,
    repo: "silo-labs/silo-location",
    today: "2026-10-16",
  });
});

test("project.get tells whether the machine has a folder for the project, from the local port", async () => {
  const project = createProjectDoc({ ...metaWith(null), description: null });
  const docs = {
    ...stubDocs,
    project: () => project,
    activity: () => NO_ACTIVITY,
    today: () => "2026-10-16",
  };
  const linked = createGateHandlers({ ...stubHandlerDeps, docs, hasFolder: (id) => id === "p1" });
  expect((await linked.project("p1")).hasFolder).toBe(true);
  const unlinked = createGateHandlers({ ...stubHandlerDeps, docs, hasFolder: () => false });
  expect((await unlinked.project("p1")).hasFolder).toBe(false);
});
