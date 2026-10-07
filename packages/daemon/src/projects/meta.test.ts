import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectMeta, ProjectSummary } from "@kibo/schema";
import { createProjectSettings } from "../notes/settings";
import { LOCAL_WORKTREE_KEY } from "../project-folder";
import { createService } from "../service";
import { openStore } from "../store";
import { writeProjectMeta } from "./meta";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const worktree = { baseRef: "origin/dev", pathTemplate: "../emis-{slug}", setup: "pnpm worktree {branch}" };

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
