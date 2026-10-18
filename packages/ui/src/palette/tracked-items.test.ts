import { expect, test } from "bun:test";
import type { ProjectSnapshot, ProjectSummary } from "@kibo/schema";
import { kiboProject, projectsFixture } from "../agents/fixtures";
import { trackingProject } from "../project-agent/tracking-fixtures";
import { buildItems, type PaletteContext, searchItems } from "./palette-items";

const emis = trackingProject();
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
  const labels = actionLabels(emis);
  expect(labels).toContain("Nouvelle fonctionnalité");
  expect(labels).toContain("Nouveau sprint");
  expect(labels).toContain("Nouvelle question");
  expect(labels).not.toContain("Nouvelle page");
});

const creationRun = (ctx: PaletteContext, label: string) =>
  (searchItems(buildItems(ctx), "", "actions")[0]?.items ?? []).find((i) => i.label === label)?.run;

test("the creations carry their intent: newFeature on Planning, a sprint opens Planning, newQuestion without a ticket opens Questions", () => {
  const items = searchItems(buildItems(context(emis)), "", "actions")[0]?.items ?? [];
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
  const ticket = emis.tickets.find((t) => t.key);
  if (!ticket) throw new Error("fixture without ticket");
  expect(creationRun({ ...context(emis), activeTicketId: ticket.id }, "Nouvelle question")).toEqual({
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
  const all = buildItems(context(emis));
  const sprint = searchItems(all, "S42", "all")
    .flatMap((s) => s.items)
    .find((i) => i.id.startsWith("sprint:"));
  expect(sprint?.label).toBe("S42 · Terrain hors ligne");
  expect(sprint?.run).toEqual({ kind: "local", action: { kind: "openSprint", sprintId: "s42" } });
  const feature = searchItems(all, "F5", "tickets")[0]?.items[0];
  expect(feature?.label.startsWith("F5 · ")).toBe(true);
});
