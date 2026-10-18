import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branchRefOf, type ProjectSnapshot, type ProjectSummary, type RpcRequest } from "@kibo/schema";
import { boot, type Harness } from "../components/service.test-helper";
import { createProjectSettings } from "../notes/settings";
import { createDemoProject, DEMO_FLAG, isDemoProject, seedFromProject } from "./demo-project";

const dirs: string[] = [];
const harnesses: Harness[] = [];
afterEach(async () => {
  for (const h of harnesses.splice(0)) await h.stop();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const TODAY = "2026-10-21";

async function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-demo-"));
  dirs.push(home);
  const h = await boot(home);
  harnesses.push(h);
  const settings = createProjectSettings(h.store.db);
  const deps = { handle: async (req: RpcRequest) => h.service.handle(req), settings, today: () => TODAY };
  const snapshot = (projectId: string) =>
    h.service.handle({ method: "getProject", projectId }) as ProjectSnapshot;
  const summaries = () => h.service.handle({ method: "listProjects" }) as ProjectSummary[];
  return { h, settings, deps, snapshot, summaries };
}

const byKey = (snap: ProjectSnapshot, key: string) => snap.tickets.find((t) => t.key === key);
const need = (value: string | undefined): string => {
  if (value === undefined) throw new Error("missing demo element");
  return value;
};

test("the demo is a tracking project: five pages, three sprints, three features and their steps", async () => {
  const { settings, deps, snapshot, summaries } = await setup();
  const { projectId } = await createDemoProject(deps);
  const snap = snapshot(projectId);
  expect([snap.meta.key, snap.meta.name, snap.meta.folder, snap.meta.client]).toEqual([
    "DEMO",
    "Démo Kibo",
    null,
    "Boulangerie Martin",
  ]);
  expect(snap.pages.map((p) => p.title)).toEqual([
    "Vue d'ensemble",
    "Planning",
    "Kanban",
    "Graphe",
    "Questions",
  ]);
  expect(snap.sprints.map((s) => [s.code, s.start, s.end])).toEqual([
    ["S1", "2026-10-12", "2026-10-16"],
    ["S2", "2026-10-19", "2026-10-23"],
    ["S3", "2026-10-26", "2026-10-30"],
  ]);
  const features = snap.tickets.filter((t) => t.parentId === null);
  expect(features.map((f) => [f.shortKey, f.title])).toEqual([
    ["F1", "Catalogue des produits"],
    ["F2", "Panier et commande"],
    ["F3", "Espace client"],
  ]);
  expect(features.map((f) => snap.sprints.find((s) => s.id === f.sprintId)?.code)).toEqual([
    "S1",
    "S2",
    "S3",
  ]);
  const steps = snap.tickets.filter((t) => t.parentId !== null);
  expect(steps.map((t) => [t.key, t.statusId])).toEqual([
    ["DEMO-1", "done"],
    ["DEMO-2", "done"],
    ["DEMO-3", "in_review"],
    ["DEMO-4", "in_progress"],
    ["DEMO-5", "todo"],
    ["DEMO-6", "todo"],
    ["DEMO-7", "todo"],
  ]);
  const pr = byKey(snap, "DEMO-3")?.externalRefs.find((r) => r.kind === "github_pr");
  expect(pr).toMatchObject({ number: 3, state: "open", url: "https://github.com/kibo-demo/boutique/pull/3" });
  expect(branchRefOf(byKey(snap, "DEMO-4")?.externalRefs ?? [])?.branch).toBe("demo/paiement");
  expect(snap.links).toHaveLength(1);
  expect(isDemoProject(settings, projectId)).toBe(true);
  expect(settings.get(projectId, DEMO_FLAG)).toBe("1");
  expect(summaries().find((p) => p.id === projectId)?.demo).toBe(true);
});

test("one blocking question for the client, and the seed names what the tour watches", async () => {
  const { deps, snapshot } = await setup();
  const { projectId, seed } = await createDemoProject(deps);
  const snap = snapshot(projectId);
  expect(snap.questions.map((q) => [q.blocking, q.recipient, q.answer, q.ticketId])).toEqual([
    [true, "client", null, need(byKey(snap, "DEMO-6")?.id)],
  ]);
  const page = (title: string) => need(snap.pages.find((p) => p.title === title)?.id);
  expect(seed).toEqual({
    featureIds: snap.tickets.filter((t) => t.parentId === null).map((t) => t.id),
    reviewTicketId: need(byKey(snap, "DEMO-4")?.id),
    questionId: need(snap.questions[0]?.id),
    copyTicketId: need(byKey(snap, "DEMO-5")?.id),
    overviewPageId: page("Vue d'ensemble"),
    planningPageId: page("Planning"),
    kanbanPageId: page("Kanban"),
    questionsPageId: page("Questions"),
  });
  expect(seedFromProject(snap)).toEqual(seed);
});

test("createDemoProject refuses when a DEMO project already exists", async () => {
  const { h, deps, summaries } = await setup();
  h.service.handle({ method: "createProject", name: "Démo", key: "DEMO", folder: null, color: "#F97316" });
  await expect(createDemoProject(deps)).rejects.toThrow("CONFLICT: the demo project already exists");
  expect(summaries()).toHaveLength(1);
});

test("seedFromProject refuses a demo that lost its pages, steps or question", async () => {
  const { deps, snapshot } = await setup();
  const { projectId } = await createDemoProject(deps);
  const snap = snapshot(projectId);
  expect(() => seedFromProject({ ...snap, pages: [] })).toThrow("CONFLICT");
  expect(() => seedFromProject({ ...snap, questions: [] })).toThrow("CONFLICT");
  expect(() => seedFromProject({ ...snap, tickets: snap.tickets.filter((t) => t.key !== "DEMO-4") })).toThrow(
    "CONFLICT",
  );
});
