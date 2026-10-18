import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY_DELIVERY, type ProjectMeta, type ProjectSummary } from "@kibo/schema";
import { createProjectSettings } from "../notes/settings";
import { LOCAL_DELIVERY_KEY, LOCAL_WORKTREE_KEY } from "../project-folder";
import { createService } from "../service";
import { openStore } from "../store";
import { writeProjectMeta } from "./meta";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const worktree = {
  baseRef: "origin/dev",
  pathTemplate: "../emis-{slug}",
  setup: "pnpm worktree {branch}",
  recipe: null,
};

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "kibo-meta-"));
  dirs.push(dir);
  const store = openStore(dir);
  const service = createService(store, { user: "adam" });
  const settings = createProjectSettings(store.db);
  const project = service.handle({
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  return { service, settings, project };
}

test("worktree settings are written locally, never to the project doc nor the workspace", () => {
  const { service, settings, project } = setup();
  const meta = writeProjectMeta(service.docs, settings, project.id, { worktree }, true);
  expect(meta.worktree).toEqual(worktree);
  expect(JSON.parse(settings.get(project.id, LOCAL_WORKTREE_KEY) ?? "null")).toEqual(worktree);
  expect(JSON.stringify(service.docs.project(project.id).toJSON())).not.toContain("pnpm worktree");
  expect(JSON.stringify(service.docs.workspace.toJSON())).not.toContain("pnpm worktree");
  const listed = service.handle({ method: "listProjects" }) as ProjectSummary[];
  expect(listed.find((p) => p.id === project.id)?.worktree).toEqual(worktree);
});

test("a mixed patch splits: the name goes to the docs, the worktree stays local", () => {
  const { service, settings, project } = setup();
  const meta = writeProjectMeta(service.docs, settings, project.id, { name: "Emis 2", worktree }, true);
  expect(meta).toMatchObject({ name: "Emis 2", worktree });
  expect(service.docs.project(project.id).getMap("meta").get("name")).toBe("Emis 2");
  expect(service.docs.project(project.id).getMap("meta").get("worktree")).toBeUndefined();
});

test("a null worktree unsets the local settings", () => {
  const { service, settings, project } = setup();
  writeProjectMeta(service.docs, settings, project.id, { worktree }, true);
  const meta = writeProjectMeta(service.docs, settings, project.id, { worktree: null }, true);
  expect(meta.worktree).toBeNull();
  expect(settings.get(project.id, LOCAL_WORKTREE_KEY)).toBeNull();
});

test("delivery settings are local, listed, and a null delivery unsets them", () => {
  const { service, settings, project } = setup();
  const delivery = { ...EMPTY_DELIVERY, root: "/home/dev/Documents/emis", allow: ["Bash(pnpm *)"] };
  const meta = writeProjectMeta(service.docs, settings, project.id, { delivery }, true);
  expect(meta.delivery).toEqual(delivery);
  expect(JSON.parse(settings.get(project.id, LOCAL_DELIVERY_KEY) ?? "null")).toEqual(delivery);
  expect(JSON.stringify(service.docs.project(project.id).toJSON())).not.toContain("Documents/emis");
  expect(JSON.stringify(service.docs.workspace.toJSON())).not.toContain("Documents/emis");
  const listed = service.handle({ method: "listProjects" }) as ProjectSummary[];
  expect(listed.find((p) => p.id === project.id)?.delivery).toEqual(delivery);
  expect(writeProjectMeta(service.docs, settings, project.id, { delivery: null }, true).delivery).toBeNull();
  expect(settings.get(project.id, LOCAL_DELIVERY_KEY)).toBeNull();
});

test("the description is synced in the project doc, never in the workspace registry", () => {
  const { service, settings, project } = setup();
  for (const folderInDoc of [false, true]) {
    const description = `Terrain hors ligne ${folderInDoc}`;
    const meta = writeProjectMeta(service.docs, settings, project.id, { description }, folderInDoc);
    expect(meta.description).toBe(description);
    expect(service.docs.project(project.id).getMap("meta").get("description")).toBe(description);
    expect(JSON.stringify(service.docs.workspace.toJSON())).not.toContain("Terrain hors ligne");
  }
  expect(
    writeProjectMeta(service.docs, settings, project.id, { description: null }, false).description,
  ).toBeNull();
});

test("the client is synced in the project doc, never in the workspace registry", () => {
  const { service, settings, project } = setup();
  for (const folderInDoc of [false, true]) {
    const client = `Chantiers SA ${folderInDoc}`;
    const meta = writeProjectMeta(service.docs, settings, project.id, { client }, folderInDoc);
    expect(meta.client).toBe(client);
    expect(service.docs.project(project.id).getMap("meta").get("client")).toBe(client);
    expect(JSON.stringify(service.docs.workspace.toJSON())).not.toContain("Chantiers SA");
  }
  expect(writeProjectMeta(service.docs, settings, project.id, { client: null }, false).client).toBeNull();
});

test("createProject and a later update write the client to the project doc only", () => {
  const { service } = setup();
  const created = service.handle({
    method: "createProject",
    name: "Suivi",
    key: "SUI",
    folder: null,
    color: "#F97316",
    client: "Bâtisseurs SA",
  }) as ProjectMeta;
  expect(created.client).toBe("Bâtisseurs SA");
  expect(service.docs.project(created.id).getMap("meta").get("client")).toBe("Bâtisseurs SA");
  const updated = service.docs.updateProjectMeta(created.id, { client: "Emis SA" }, false);
  expect(updated.client).toBe("Emis SA");
  expect(service.docs.project(created.id).getMap("meta").get("client")).toBe("Emis SA");
  const registry = JSON.stringify(service.docs.workspace.toJSON());
  expect(registry).not.toContain("Bâtisseurs SA");
  expect(registry).not.toContain("Emis SA");
  const listed = service.handle({ method: "listProjects" }) as ProjectSummary[];
  expect(listed.find((p) => p.id === created.id)?.client).toBe("Emis SA");
});

test("an invalid client is refused before the project is registered", () => {
  const { service } = setup();
  const create = () =>
    service.handle({
      method: "createProject",
      name: "Suivi",
      key: "SUI",
      folder: null,
      color: "#F97316",
      client: "x".repeat(61),
    });
  expect(create).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  const listed = service.handle({ method: "listProjects" }) as ProjectSummary[];
  expect(listed.map((p) => p.key)).toEqual(["EMIS"]);
});
