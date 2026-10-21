import { expect, test } from "bun:test";
import type { ProjectSnapshot, ProjectSummary } from "@kibo/schema";
import { kiboProject, projectsFixture } from "../agents/fixtures";
import { sprintProject } from "../project-agent/sprint-fixtures";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const silo = sprintProject();
const counts = projectsFixture[0]?.counts;
if (!counts) throw new Error("fixture without counts");
const summary = (p: ProjectSnapshot): ProjectSummary => ({ ...p.meta, counts });

const context = (project: ProjectSnapshot): PaletteContext => ({
  projects: [summary(project)],
  snapshots: new Map([[project.meta.id, project]]),
  recents: [],
  activeProjectId: project.meta.id,
  activeTicketId: null,
  agents: null,
  executionShown: false,
});

const actionLabels = (project: ProjectSnapshot) =>
  (searchItems(buildItems(context(project)), "", "actions")[0]?.items ?? []).map((i) => i.label);

test("a tracked project offers its creations and no Nouvelle page", () => {
  const labels = actionLabels(silo);
  expect(labels).toContain("Nouvelle fonctionnalité");
  expect(labels).toContain("Nouveau sprint");
  expect(labels).toContain("Nouvelle question");
  expect(labels).not.toContain("Nouvelle page");
});

const creationRun = (ctx: PaletteContext, label: string) =>
  (searchItems(buildItems(ctx), "", "actions")[0]?.items ?? []).find((i) => i.label === label)?.run;

test("the creations carry their intent: newFeature on Planning, a sprint opens Planning, newQuestion without a ticket opens Questions", () => {
  const items = searchItems(buildItems(context(silo)), "", "actions")[0]?.items ?? [];
  const runOf = (label: string) => items.find((i) => i.label === label)?.run;
  expect(runOf("Nouvelle fonctionnalité")).toEqual({
    kind: "local",
    action: { kind: "openView", componentId: "planning", spotlight: { kind: "newFeature" } },
  });
  expect(runOf("Nouveau sprint")).toEqual({
    kind: "local",
    action: { kind: "openView", componentId: "planning" },
  });
  expect(runOf("Nouvelle question")).toEqual({
    kind: "local",
    action: { kind: "openView", componentId: "questions" },
  });
});

test("Nouvelle question asks about the current ticket when there is one", () => {
  const ticket = silo.tickets.find((t) => t.key);
  if (!ticket) throw new Error("fixture without ticket");
  expect(creationRun({ ...context(silo), activeTicketId: ticket.id }, "Nouvelle question")).toEqual({
    kind: "local",
    action: {
      kind: "openView",
      componentId: "questions",
      spotlight: { kind: "newQuestion", ticketId: ticket.id },
    },
  });
});

test("a project without sprints keeps Nouvelle page and has no tracking creations", () => {
  const plain = { ...kiboProject(), sprints: [] };
  const labels = actionLabels(plain);
  expect(labels).toContain("Nouvelle page");
  expect(labels).not.toContain("Nouveau sprint");
});

test("sprints and features are indexed: S42 opens its sheet, F5 its feature", () => {
  const all = buildItems(context(silo));
  const sprint = searchItems(all, "S42", "all")
    .flatMap((s) => s.items)
    .find((i) => i.id.startsWith("sprint:"));
  expect(sprint?.label).toBe("S42 · Saisie hors ligne");
  expect(sprint?.run).toEqual({ kind: "local", action: { kind: "openSprint", sprintId: "s42" } });
  const feature = searchItems(all, "F5", "tickets")[0]?.items[0];
  expect(feature?.label.startsWith("F5 · ")).toBe(true);
});

test("a full-page ticket addressed by its key still offers the copy", () => {
  const ticket = silo.tickets.find((t) => t.key === "SILO-30");
  if (!ticket?.key) throw new Error("fixture without key");
  const labels = (
    searchItems(buildItems({ ...context(silo), activeTicketId: ticket.key }), "", "actions")[0]?.items ?? []
  ).map((i) => i.label);
  expect(labels).toContain(`Copier /full-delivery ${ticket.key}`);
});

test("the palette copy carries the start reason of the ticket", () => {
  const ticket = silo.tickets.find((t) => t.key === "SILO-30");
  if (!ticket?.key) throw new Error("fixture without key");
  const startReason = { kind: "sprint" as const, code: "S43" };
  const project = {
    ...silo,
    tickets: silo.tickets.map((t) => (t.id === ticket.id ? { ...t, startReason } : t)),
  };
  const copy = (
    searchItems(buildItems({ ...context(project), activeTicketId: ticket.id }), "", "actions")[0]?.items ?? []
  ).find((i) => i.id === "action:copyDelivery");
  expect(copy?.run).toMatchObject({
    kind: "local",
    action: { kind: "copyDelivery", ticket: { startReason } },
  });
});
