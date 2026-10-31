import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProject } from "@kibo/core";
import type { ProjectCommand, ProjectMeta, ProjectSetup, ProjectSnapshot } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createClock } from "../clock";
import type { CommandMeta, Docs } from "../docs";
import { migrateTracking, OVERVIEW_MIGRATED_KEY, TRACKING_MIGRATED_KEY } from "../migrations/tracking";
import { createProjectSettings } from "../notes/settings";
import { createService } from "../service";
import { openStore } from "../store";
import { handleProjectRequest, type ProjectRpcDeps } from "./project-rpc";
import { setupProject } from "./project-setup";

const NOW = "2026-10-16T14:52:00+02:00";
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function open() {
  const dir = mkdtempSync(join(tmpdir(), "kibo-project-setup-"));
  dirs.push(dir);
  const store = openStore(dir);
  const service = createService(store, { user: "adam", clock: createClock(NOW) });
  const settings = createProjectSettings(store.db);
  const create = (setup?: ProjectSetup) =>
    service.handle({
      method: "createProject",
      name: "Silo",
      key: "SILO",
      folder: null,
      color: "#F97316",
      ...(setup !== undefined && { setup }),
    }) as ProjectMeta;
  const snapshot = (projectId: string) =>
    service.handle({ method: "getProject", projectId }) as ProjectSnapshot;
  return { service, settings, create, snapshot };
}

const SIX_WEEKS: ProjectSetup = { sprintStart: "2026-10-19", sprintCount: 6, sprintWeeks: 1 };

test("createProject with a setup seeds the five view pages in order with their instances", () => {
  const { create, snapshot } = open();
  const snap = snapshot(create(SIX_WEEKS).id);
  expect(snap.pages.map((p) => [p.title, p.kind, p.parentId])).toEqual([
    ["Vue d'ensemble", "view", null],
    ["Planning", "view", null],
    ["Kanban", "view", null],
    ["Graphe", "view", null],
    ["Questions", "view", null],
  ]);
  const instanceOf = (pageId: string) => snap.instances.filter((i) => i.pageId === pageId);
  expect(snap.pages.map((p) => instanceOf(p.id).map((i) => [i.component, i.config]))).toEqual([
    [["overview@1.0.0", {}]],
    [["planning@1.0.0", {}]],
    [["kanban@1.0.0", { filter: "all" }]],
    [["graph@1.0.0", { filter: "all" }]],
    [["questions@1.0.0", {}]],
  ]);
});

test("createProject with a setup creates S1 to S6, one week each, from Monday to Friday", () => {
  const { create, snapshot } = open();
  const sprints = snapshot(create(SIX_WEEKS).id).sprints;
  expect(sprints.map((s) => [s.code, s.name, s.start, s.end])).toEqual([
    ["S1", "Sprint 1", "2026-10-19", "2026-10-23"],
    ["S2", "Sprint 2", "2026-10-26", "2026-10-30"],
    ["S3", "Sprint 3", "2026-11-02", "2026-11-06"],
    ["S4", "Sprint 4", "2026-11-09", "2026-11-13"],
    ["S5", "Sprint 5", "2026-11-16", "2026-11-20"],
    ["S6", "Sprint 6", "2026-11-23", "2026-11-27"],
  ]);
});

test("two-week sprints last eleven days", () => {
  const { create, snapshot } = open();
  const sprints = snapshot(create({ sprintStart: "2026-10-19", sprintCount: 2, sprintWeeks: 2 }).id).sprints;
  expect(sprints.map((s) => [s.code, s.start, s.end])).toEqual([
    ["S1", "2026-10-19", "2026-10-30"],
    ["S2", "2026-11-02", "2026-11-13"],
  ]);
});

test("a seeded project is marked migrated and the tracking migration runs nothing", () => {
  const { service, settings, create } = open();
  const project = create(SIX_WEEKS);
  expect(settings.get(project.id, TRACKING_MIGRATED_KEY)).not.toBeNull();
  expect(settings.get(project.id, OVERVIEW_MIGRATED_KEY)).not.toBeNull();
  const runs: ProjectCommand[] = [];
  const docs: Docs = {
    ...service.docs,
    run: (projectId: string, command: ProjectCommand, meta?: CommandMeta) => {
      runs.push(command);
      return service.docs.run(projectId, command, meta);
    },
  };
  expect(migrateTracking({ docs, settings, log: () => {}, now: () => Date.parse(NOW) })).toEqual({
    migrated: 0,
  });
  expect(runs).toEqual([]);
});

test("53 sprints are refused before any project is registered", () => {
  const { service, create } = open();
  expect(() => create({ sprintStart: "2026-10-19", sprintCount: 53, sprintWeeks: 1 })).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
  expect(service.handle({ method: "listProjects" })).toEqual([]);
});

test("without a setup a project has no page and no sprint, and is left to the migration", () => {
  const { settings, create, snapshot } = open();
  const project = create();
  const snap = snapshot(project.id);
  expect(snap.pages).toEqual([]);
  expect(snap.sprints).toEqual([]);
  expect(settings.get(project.id, TRACKING_MIGRATED_KEY)).toBeNull();
});

test("setupProject runs its commands through the given runner and returns what they created", () => {
  const { service, create } = open();
  const project = create();
  const commands: ProjectCommand[] = [];
  const seeded = setupProject(
    (command) => {
      commands.push(command);
      return service.docs.run(project.id, command, { origin: "kibo", instanceId: null });
    },
    { sprintStart: "2026-10-19", sprintCount: 1, sprintWeeks: 1 },
  );
  const pageCommands: ProjectCommand["method"][] = ["addPage", "addInstance"];
  expect(commands.map((c) => c.method)).toEqual([
    ...Array.from({ length: 5 }, () => pageCommands).flat(),
    "createSprint",
  ]);
  expect(seeded.pages.map((p) => p.title)).toEqual([
    "Vue d'ensemble",
    "Planning",
    "Kanban",
    "Graphe",
    "Questions",
  ]);
  expect(seeded.sprints.map((s) => [s.code, s.start, s.end])).toEqual([["S1", "2026-10-19", "2026-10-23"]]);
});

test("the seed is built before registration: a refused project leaves no page, sprint nor doc behind", () => {
  const { service, settings, create } = open();
  const first = create();
  const before = service.docs.projectIds();
  expect(() => create(SIX_WEEKS)).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  expect(service.docs.projectIds()).toEqual(before);
  expect(service.handle({ method: "listProjects" })).toEqual([expect.objectContaining({ id: first.id })]);
  expect(settings.get(first.id, TRACKING_MIGRATED_KEY)).toBeNull();
});

test("the seed never goes through the live command path, so a failing command cannot leave a half-seeded project", () => {
  const { service, settings } = open();
  const adopted = new Map<string, LoroDoc>();
  const deps: ProjectRpcDeps = {
    workspace: service.docs.workspace,
    docs: {
      ...service.docs,
      save: () => {},
      run: () => {
        throw new Error("the live command path must not seed a new project");
      },
    },
    icons: service.icons,
    settings,
    adopt: (id, doc) => adopted.set(id, doc),
    fileTicket: () => ({ ticketId: "", key: null }),
  };
  const project = handleProjectRequest(deps, {
    method: "createProject",
    name: "Silo",
    key: "SILO",
    folder: null,
    color: "#F97316",
    setup: SIX_WEEKS,
  }) as ProjectMeta;
  const doc = adopted.get(project.id);
  if (!doc) throw new Error("the project doc was not adopted");
  const snap = readProject(doc, "2026-10-16");
  expect(snap.pages).toHaveLength(5);
  expect(snap.sprints).toHaveLength(6);
});
