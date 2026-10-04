import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectSnapshot, ProjectSummary, RpcRequest } from "@kibo/schema";
import { boot, type Harness } from "../components/service.test-helper";
import { createProjectSettings } from "../notes/settings";
import { createDemoProject, DEMO_FLAG, isDemoProject, noteHashOf } from "./demo-project";
import { DEMO_NOTE } from "./demo-seed";

const dirs: string[] = [];
const harnesses: Harness[] = [];
afterEach(async () => {
  for (const h of harnesses.splice(0)) await h.stop();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-demo-"));
  dirs.push(home);
  const h = await boot(home);
  harnesses.push(h);
  const settings = createProjectSettings(h.store.db);
  const deps = { handle: async (req: RpcRequest) => h.service.handle(req), settings };
  const snapshot = (projectId: string) =>
    h.service.handle({ method: "getProject", projectId }) as ProjectSnapshot;
  const summaries = () => h.service.handle({ method: "listProjects" }) as ProjectSummary[];
  return { home, h, settings, deps, snapshot, summaries };
}

test("createDemoProject builds the project through the public API and marks it demo", async () => {
  const { home, h, settings, deps, snapshot, summaries } = await setup();
  const { projectId, seed } = await createDemoProject(deps);
  const snap = snapshot(projectId);
  expect([snap.meta.key, snap.meta.name, snap.meta.folder]).toEqual(["DEMO", "Démo Kibo", null]);
  expect(snap.tickets).toHaveLength(8);
  expect(snap.tickets.filter((t) => t.statusId === "done")).toHaveLength(2);
  expect(snap.tickets.find((t) => t.title === "Bac à sable des composants")?.blockedReason).toBe(
    "Audit en attente",
  );
  const parent = snap.tickets.find((t) => t.title === "Noyau de données");
  expect(snap.tickets.filter((t) => t.parentId === parent?.id)).toHaveLength(2);
  expect(snap.links).toHaveLength(2);
  expect(snap.bindings).toEqual([]);
  expect(snap.pages.map((p) => p.title)).toEqual(["Tableau de bord", "Kanban", "Graphe", "Notes"]);
  expect(snap.instances).toHaveLength(6);
  expect(snap.instances.every((i) => i.component.endsWith("@1.0.0"))).toBe(true);
  expect(isDemoProject(settings, projectId)).toBe(true);
  expect(settings.get(projectId, DEMO_FLAG)).toBe("1");
  expect([...seed.ticketIds].sort()).toEqual(snap.tickets.map((t) => t.id).sort());
  expect([...seed.linkKeys].sort()).toEqual(snap.links.map((l) => `${l.from}>${l.to}:${l.type}`).sort());
  const dashboard = snap.pages[0];
  expect(seed.dashboardPageId).toBe(dashboard?.id ?? "");
  expect(seed.graphPageId).toBe(snap.pages[2]?.id ?? "");
  expect(Object.keys(seed.layouts).sort()).toEqual(
    snap.instances
      .filter((i) => i.pageId === dashboard?.id)
      .map((i) => i.id)
      .sort(),
  );
  expect(h.components.notesDir(projectId)).toBe(join(home, "notes", "DEMO"));
  const note = readFileSync(join(home, "notes", "DEMO", DEMO_NOTE.path), "utf8");
  expect(note).toBe(DEMO_NOTE.markdown);
  expect(seed.noteHash).toBe(noteHashOf(DEMO_NOTE.markdown));
  expect(seed.noteHash).toMatch(/^[0-9a-f]{64}$/);
  expect(summaries().find((p) => p.id === projectId)?.demo).toBe(true);
});

test("a project that is not the demo is listed with demo false", async () => {
  const { h, summaries } = await setup();
  h.service.handle({ method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" });
  expect(summaries().map((p) => p.demo)).toEqual([false]);
});

test("createDemoProject refuses when a DEMO project already exists", async () => {
  const { h, deps, summaries } = await setup();
  h.service.handle({ method: "createProject", name: "Démo", key: "DEMO", folder: null, color: "#F97316" });
  await expect(createDemoProject(deps)).rejects.toThrow("CONFLICT: the demo project already exists");
  expect(summaries()).toHaveLength(1);
});

test("a welcome note left by a deleted demo is kept and becomes the seed", async () => {
  const { h, deps, snapshot } = await setup();
  const first = await createDemoProject(deps);
  const notes = snapshot(first.projectId).instances.find((i) => i.component.startsWith("notes@"));
  await h.service.handle({
    method: "componentCall",
    projectId: first.projectId,
    instanceId: notes?.id ?? "",
    call: {
      kind: "notes.write",
      path: DEMO_NOTE.path,
      markdown: "# Bienvenue\n\nmodifiée\n",
      expectedMtime: null,
    },
  });
  h.service.docs.removeProject(first.projectId);
  const second = await createDemoProject(deps);
  expect(second.projectId).not.toBe(first.projectId);
  expect(second.seed.noteHash).toBe(noteHashOf("# Bienvenue\n\nmodifiée\n"));
});
