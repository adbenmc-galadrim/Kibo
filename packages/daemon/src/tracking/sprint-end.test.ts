import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type ProjectCommand, ProjectMeta, Sprint, Ticket } from "@kibo/schema";
import { createService } from "../service";
import { openStore } from "../store";
import { startSprintEndWatch } from "./sprint-end";
import { createSprintEndStore } from "./sprint-end-store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const TODAY = "2026-10-17";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "kibo-sprint-end-"));
  dirs.push(dir);
  const service = createService(openStore(dir), { user: "adam" });
  const project = ProjectMeta.parse(
    service.handle({ method: "createProject", name: "Emis", key: "EMIS", folder: null, color: "#336699" }),
  );
  const run = (command: ProjectCommand): unknown =>
    service.handle({ method: "command", projectId: project.id, command });
  const sprint = (code: string, start: string, end: string): string =>
    Sprint.parse(run({ method: "createSprint", code, name: `Sprint ${code}`, start, end })).id;
  const feature = (title: string, sprintId: string, steps: ("todo" | "done")[]): string => {
    const root = Ticket.parse(run({ method: "createTicket", title, parentId: null })).id;
    for (const [i, statusId] of steps.entries())
      run({ method: "createTicket", title: `${title} ${i + 1}`, parentId: root, statusId });
    run({ method: "setTicketSprint", ticketId: root, sprintId });
    return root;
  };
  const db = new Database(":memory:", { strict: true });
  const sent: { projectId: string; text: string }[] = [];
  const errors: string[] = [];
  const agent = { fail: false };
  const store = createSprintEndStore(db, () => 1_000);
  const watch = startSprintEndWatch({
    docs: service.docs,
    store,
    agent: () => ({
      send(projectId, text) {
        if (agent.fail) throw new KiboError("INTERNAL", "queue unavailable");
        sent.push({ projectId, text });
      },
    }),
    today: () => TODAY,
    log: (what) => () => errors.push(what),
  });
  return { service, project, sprint, feature, run, store, watch, sent, errors, agent };
}

test("an ended sprint with work left wakes the project agent once", () => {
  const { project, sprint, feature, store, watch, sent } = setup();
  const s1 = sprint("S1", "2026-10-12", "2026-10-16");
  feature("Saisir hors ligne", s1, ["done", "done"]);
  feature("Envoyer les photos", s1, ["done", "todo", "todo"]);
  watch.pass();
  expect(sent).toEqual([
    {
      projectId: project.id,
      text: "S1 est terminé : F2 a 2 étapes restantes (EMIS-6, EMIS-7). F1 est livrée. Propose un report ou un retrait du planning.",
    },
  ]);
  expect(store.has(s1)).toBe(true);
  watch.pass();
  expect(sent).toHaveLength(1);
});

test("an ended sprint with nothing left is marked without a message", () => {
  const { sprint, feature, store, watch, sent } = setup();
  const s1 = sprint("S1", "2026-10-12", "2026-10-16");
  feature("Saisir hors ligne", s1, ["done"]);
  watch.pass();
  expect(sent).toEqual([]);
  expect(store.has(s1)).toBe(true);
});

test("a sprint that ends today or later is left alone", () => {
  const { sprint, feature, store, watch, sent } = setup();
  const today = sprint("S2", "2026-10-13", TODAY);
  const later = sprint("S3", "2026-10-19", "2026-10-23");
  feature("Saisir hors ligne", today, ["todo"]);
  feature("Envoyer les photos", later, ["todo"]);
  watch.pass();
  expect(sent).toEqual([]);
  expect(store.has(today)).toBe(false);
  expect(store.has(later)).toBe(false);
});

test("a sprint ended more than seven days ago is marked without a message", () => {
  const { sprint, feature, store, watch, sent } = setup();
  const old = sprint("S0", "2026-10-01", "2026-10-09");
  const recent = sprint("S1", "2026-10-05", "2026-10-10");
  feature("Saisir hors ligne", old, ["todo"]);
  feature("Envoyer les photos", recent, ["todo"]);
  watch.markOld();
  expect(store.has(old)).toBe(true);
  expect(store.has(recent)).toBe(false);
  expect(sent).toEqual([]);
  watch.pass();
  expect(sent.map((s) => s.text.slice(0, 16))).toEqual(["S1 est terminé :"]);
});

test("the history is never woken, even without markOld", () => {
  const { sprint, feature, store, watch, sent } = setup();
  const old = sprint("S0", "2026-10-01", "2026-10-09");
  feature("Saisir hors ligne", old, ["todo"]);
  watch.pass();
  expect(sent).toEqual([]);
  expect(store.has(old)).toBe(true);
});

test("a failed wake-up is logged and tried again on the next pass", () => {
  const { sprint, feature, store, watch, sent, errors, agent } = setup();
  const s1 = sprint("S1", "2026-10-12", "2026-10-16");
  feature("Saisir hors ligne", s1, ["todo"]);
  agent.fail = true;
  watch.pass();
  expect(errors).toHaveLength(1);
  expect(store.has(s1)).toBe(false);
  agent.fail = false;
  watch.pass();
  expect(sent).toHaveLength(1);
  expect(store.has(s1)).toBe(true);
});

test("a read-only project is not woken", () => {
  const { service, sprint, feature, store, watch, sent } = setup();
  const s1 = sprint("S1", "2026-10-12", "2026-10-16");
  feature("Saisir hors ligne", s1, ["todo"]);
  service.docs.setWriteGuard(() => {
    throw new KiboError("FORBIDDEN", "read-only project");
  });
  watch.pass();
  expect(sent).toEqual([]);
  expect(store.has(s1)).toBe(false);
});

test("the wake-up moves nothing", () => {
  const { service, project, sprint, feature, watch } = setup();
  const s1 = sprint("S1", "2026-10-12", "2026-10-16");
  const root = feature("Saisir hors ligne", s1, ["todo"]);
  const before = service.handle({ method: "getProject", projectId: project.id });
  watch.pass();
  expect(service.handle({ method: "getProject", projectId: project.id })).toEqual(before);
  expect(before).toMatchObject({ tickets: expect.arrayContaining([expect.objectContaining({ id: root })]) });
});

test("the marks survive a reopening of the database", () => {
  const db = new Database(":memory:", { strict: true });
  createSprintEndStore(db, () => 1_000).mark("p", "s1");
  expect(createSprintEndStore(db, () => 2_000).has("s1")).toBe(true);
});
