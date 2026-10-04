import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { putRegistryVersion } from "@kibo/core";
import { NO_PERMISSIONS, type ProjectMeta, type Ticket } from "@kibo/schema";
import { createService } from "../service";
import { openStore, type Store } from "../store";
import { noteHashOf } from "./demo-project";
import { DEMO_NOTE } from "./demo-seed";
import { aiComponentIds, createTutorialSnapshot } from "./tutorial-snapshot";

const dirs: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-tutorial-snap-"));
  dirs.push(home);
  const store = openStore(home);
  stores.push(store);
  const service = createService(store, { user: "adam" });
  const meta = service.handle({
    method: "createProject",
    name: "Démo Kibo",
    key: "DEMO",
    folder: null,
    color: "#F97316",
  }) as ProjectMeta;
  const notesDir = join(home, "notes", "DEMO");
  const snapshot = createTutorialSnapshot({
    docs: service.docs,
    notesDir: () => notesDir,
    runs: () => [{ profileId: "demo", projectId: meta.id, state: "done" }],
  });
  return { service, meta, notesDir, snapshot };
}

const registryVersion = (origin: "ai" | "user") => ({
  version: "0.1.0",
  hash: "a".repeat(64),
  origin,
  trust: "sandboxed" as const,
  approvedHash: null,
  granted: NO_PERMISSIONS,
  publishedAt: 1,
  autoUpdate: false,
  source: null,
  revoked: null,
});

test("the snapshot reads the demo doc, the welcome note, the runs and the ai components", () => {
  const { service, meta, notesDir, snapshot } = setup();
  const ticket = service.handle({
    method: "command",
    projectId: meta.id,
    command: { method: "createTicket", title: "Essai", statusId: "in_progress" },
  }) as Ticket;
  expect(snapshot(meta.id)?.noteHash).toBeNull();
  mkdirSync(notesDir, { recursive: true });
  writeFileSync(join(notesDir, DEMO_NOTE.path), "# Bienvenue\n");
  putRegistryVersion(service.docs.workspace, "chart", "Graphique", registryVersion("ai"));
  const snap = snapshot(meta.id);
  expect(snap?.tickets.map((t) => [t.id, t.statusId])).toEqual([[ticket.id, "in_progress"]]);
  expect(snap?.noteHash).toBe(noteHashOf("# Bienvenue\n"));
  expect(snap?.runs).toEqual([{ profileId: "demo", projectId: meta.id, state: "done" }]);
  expect(snap?.aiComponentIds).toEqual(["chart"]);
});

test("a deleted project has no snapshot", () => {
  const { snapshot } = setup();
  expect(snapshot("gone")).toBeNull();
});

test("only components with an ai version count as ai components", () => {
  const { service } = setup();
  putRegistryVersion(service.docs.workspace, "mine", "Mien", registryVersion("user"));
  putRegistryVersion(service.docs.workspace, "chart", "Graphique", registryVersion("ai"));
  expect(aiComponentIds(service.docs.workspace)).toEqual(["chart"]);
});
