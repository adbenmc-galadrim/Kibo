import { expect, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot, type TabTarget } from "@kibo/schema";
import { kiboProject, projectsFixture } from "../lib/fixtures";
import { crumbsFor } from "../shell/Breadcrumb";
import { describeTarget } from "./tab-title";

const kibo = kiboProject();
const inbox: ProjectSnapshot = {
  ...kibo,
  meta: {
    id: INBOX_ID,
    key: "INB",
    name: "Inbox",
    folder: null,
    color: "#64748B",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  tickets: (kibo.tickets[0] ? [kibo.tickets[0]] : []).map((t) => ({
    ...t,
    id: "i3",
    key: "INB-3",
    keyLabel: "INB-3",
  })),
};
const ctx = { projects: projectsFixture, snapshots: new Map([[INBOX_ID, inbox]]) };
const inboxTicket: TabTarget = { kind: "ticket", projectId: INBOX_ID, ticketId: "i3" };

test("an inbox ticket tab is titled after its key and title, never as a missing project", () => {
  const tab = describeTarget(inboxTicket, ctx);
  expect(tab.title).toBe(`INB-3 · ${inbox.tickets[0]?.title}`);
  expect(tab.missing).toBe(false);
});

test("the breadcrumb names the inbox in French", () => {
  const labels = (target: TabTarget, project: ProjectSnapshot | null) =>
    crumbsFor(target, { project }).map((c) => c.label);
  expect(labels(inboxTicket, inbox)).toEqual(["Boîte de réception", "INB-3"]);
  expect(labels({ kind: "screen", screen: "general" }, null)).toEqual(["Paramètres", "Général"]);
});

test("a sprint tab is titled after its code and its crumbs lead back to the Planning", async () => {
  const { siloFeatureProject } = await import("../shell/feature/fixture");
  const silo = siloFeatureProject();
  const projects = [{ ...silo.meta, counts: projectsFixture[0]?.counts ?? {} }] as typeof projectsFixture;
  const sprintCtx = { projects, snapshots: new Map([["silo", silo]]) };
  const sprint: TabTarget = { kind: "sprint", projectId: "silo", sprintId: "s42" };
  expect(describeTarget(sprint, sprintCtx)).toMatchObject({ title: "Silo · S42", missing: false });
  expect(describeTarget({ ...sprint, sprintId: "gone" }, sprintCtx).missing).toBe(true);
  const planned: ProjectSnapshot = {
    ...silo,
    pages: [{ id: "p-plan", title: "Planning", kind: "view", parentId: null }],
    instances: [
      {
        id: "i-plan",
        pageId: "p-plan",
        component: "planning@1.0.0",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        componentHash: null,
      },
    ],
  };
  expect(crumbsFor(sprint, { project: planned }).map((c) => c.label)).toEqual([
    "Silo",
    "Planning",
    "S42 · Saisie hors ligne",
  ]);
  expect(crumbsFor(sprint, { project: silo }).map((c) => c.label)).toEqual([
    "Silo",
    "S42 · Saisie hors ligne",
  ]);
});

test("a ticket tab is titled « key · title » and found by its key as well as by its id", async () => {
  const { siloFeatureProject } = await import("../shell/feature/fixture");
  const silo = siloFeatureProject();
  const projects = [{ ...silo.meta, counts: projectsFixture[0]?.counts ?? {} }] as typeof projectsFixture;
  const siloCtx = { projects, snapshots: new Map([["silo", silo]]) };
  const byId: TabTarget = { kind: "ticket", projectId: "silo", ticketId: "e33" };
  const byKey: TabTarget = { kind: "ticket", projectId: "silo", ticketId: "SILO-33" };
  expect(describeTarget(byId, siloCtx)).toMatchObject({
    title: "SILO-33 · Écran d'envoi hors ligne",
    missing: false,
  });
  expect(describeTarget(byKey, siloCtx)).toMatchObject({
    title: "SILO-33 · Écran d'envoi hors ligne",
    missing: false,
  });
  expect(describeTarget({ ...byKey, ticketId: "SILO-999" }, siloCtx).missing).toBe(true);
  const crumbs = (target: TabTarget) => crumbsFor(target, { project: silo }).map((c) => c.label);
  expect(crumbs(byKey)).toEqual(crumbs(byId));
});
