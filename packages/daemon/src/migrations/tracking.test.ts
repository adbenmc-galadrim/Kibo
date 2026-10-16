import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
  type ProjectSnapshot,
  type Ticket,
} from "@kibo/schema";
import type { CommandMeta, Docs } from "../docs";
import { createProjectSettings } from "../notes/settings";
import { createService } from "../service";
import { openStore } from "../store";
import { migrateTracking } from "./tracking";

const homes: string[] = [];
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

const NOW = Date.parse("2026-10-16T12:52:00Z");

function open(home: string) {
  const store = openStore(home);
  const service = createService(store, { user: "adam" });
  const settings = createProjectSettings(store.db);
  const runs: { projectId: string; command: ProjectCommand; meta: CommandMeta | undefined }[] = [];
  const docs: Docs = {
    ...service.docs,
    run: (projectId, command, meta) => {
      runs.push({ projectId, command, meta });
      return service.docs.run(projectId, command, meta);
    },
  };
  const lines: string[] = [];
  const migrate = () => migrateTracking({ docs, settings, log: (line) => lines.push(line), now: () => NOW });
  const snapshot = (projectId: string) =>
    service.handle({ method: "getProject", projectId }) as ProjectSnapshot;
  return { store, service, runs, lines, migrate, snapshot };
}

function seed() {
  const home = mkdtempSync(join(tmpdir(), "kibo-tracking-migration-"));
  homes.push(home);
  const { store, service } = open(home);
  const project = (name: string, key: string): ProjectMeta =>
    service.handle({ method: "createProject", name, key, folder: null, color: "#F97316" }) as ProjectMeta;
  const emis = project("Emis", "EMIS");
  const client = project("Client", "CLI");
  const run = (projectId: string, command: ProjectCommand) =>
    service.handle({ method: "command", projectId, command });
  const root = run(emis.id, { method: "createTicket", title: "Accès" }) as Ticket;
  run(emis.id, {
    method: "upsertExternalRef",
    ticketId: root.id,
    ref: { kind: "import_ref", source: "plan", id: "C4" },
  });
  run(emis.id, { method: "createTicket", title: "Connexion", parentId: root.id });
  run(emis.id, { method: "updateTicket", ticketId: root.id, shortKey: null });
  run(client.id, { method: "createTicket", title: "Seul" });
  store.close();
  return { home, emis, client, root };
}

const planningPages = (snap: ProjectSnapshot) => snap.pages.filter((p) => p.title === "Planning");

test("each project is migrated with the kibo origin until nothing is left, then never again", () => {
  const { home, emis, client, root } = seed();
  const first = open(home);
  expect(first.migrate()).toEqual({ migrated: 2, skipped: 0 });
  expect(first.runs.every((r) => r.meta?.origin === "kibo")).toBe(true);
  const snap = first.snapshot(emis.id);
  expect(snap.tickets.find((t) => t.id === root.id)?.shortKey).toBe("C4");
  expect(planningPages(snap)).toHaveLength(1);
  expect(snap.instances.map((i) => i.component)).toEqual(["planning@1.0.0"]);
  expect(planningPages(first.snapshot(client.id))).toHaveLength(1);
  first.store.close();
  const second = open(home);
  second.migrate();
  expect(second.runs).toEqual([]);
  second.store.close();
});

test("a Planning page deleted by the user is not added back on the next start", () => {
  const { home, emis } = seed();
  const first = open(home);
  first.migrate();
  const page = planningPages(first.snapshot(emis.id))[0];
  if (page === undefined) throw new Error("no Planning page");
  first.service.handle({
    method: "command",
    projectId: emis.id,
    command: { method: "deletePage", pageId: page.id },
  });
  first.store.close();
  const second = open(home);
  second.migrate();
  expect(second.runs).toEqual([]);
  expect(planningPages(second.snapshot(emis.id))).toEqual([]);
  second.store.close();
});

test("a read-only project is left alone and logged, then migrated once it can be written", () => {
  const { home, client } = seed();
  const first = open(home);
  const off = first.service.docs.setWriteGuard((id) => {
    if (id === client.id) throw new KiboError("FORBIDDEN", `project ${id} is read-only`);
  });
  expect(first.migrate()).toEqual({ migrated: 1, skipped: 1 });
  expect(first.runs.some((r) => r.projectId === client.id)).toBe(false);
  expect(first.lines).toEqual(['tracking migration skipped: project "Client" is read-only']);
  off();
  expect(first.migrate()).toEqual({ migrated: 1, skipped: 0 });
  expect(planningPages(first.snapshot(client.id))).toHaveLength(1);
  first.store.close();
});
