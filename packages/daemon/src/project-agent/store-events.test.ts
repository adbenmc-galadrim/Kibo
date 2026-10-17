import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectEventInput, ProposedAction } from "@kibo/schema";
import { openProjectAgentStore } from "./store";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const ADAM = { kind: "human" as const, ref: "adam" };
const actions: ProposedAction[] = [
  { id: 1, why: "", type: "setSprint", ticket: "EMIS-30", sprint: "S43" },
  { id: 2, why: "", type: "setSprint", ticket: "EMIS-40", sprint: "S44" },
  { id: 3, why: "", type: "remindQuestion", questionId: "q14" },
];

function open() {
  const home = mkdtempSync(join(tmpdir(), "kibo-pa-events-"));
  dirs.push(home);
  const recorded: { projectId: string; event: ProjectEventInput }[] = [];
  const store = openProjectAgentStore(home, {
    record: (projectId, event) => recorded.push({ projectId, event }),
  });
  const batch = (id: string) =>
    store.createBatch({
      id,
      projectId: "p1",
      runId: "r1",
      sessionId: "s1",
      summary: "Fin de S42",
      actions,
      expected: [],
      createdAt: 1,
    });
  return { store, recorded, batch };
}

const lot = (
  kind: ProjectEventInput["kind"],
  data: ProjectEventInput["data"],
): { projectId: string; event: ProjectEventInput } => ({
  projectId: "p1",
  event: { kind, ticketId: null, featureId: null, source: "project-agent", data },
});

test("a proposed batch and its decision are journaled, nothing else", () => {
  const { store, recorded, batch } = open();
  const first = batch("b1");
  const decided = { type: "decided", by: ADAM, comment: null } as const;
  store.appendBatchEvent(first.id, { ...decided, decision: "apply", actionIds: [1, 3] }, 2);
  store.appendBatchEvent(first.id, { type: "results", results: [] }, 3);
  const second = batch("b2");
  store.appendBatchEvent(second.id, { type: "superseded" }, 4);
  const third = batch("b3");
  store.appendBatchEvent(third.id, { ...decided, decision: "reject", actionIds: null }, 5);
  expect(recorded).toEqual([
    lot("batch_proposed", { seq: 1, actions: 3 }),
    lot("batch_decided", { seq: 1, decision: "apply", actions: 2 }),
    lot("batch_proposed", { seq: 2, actions: 3 }),
    lot("batch_proposed", { seq: 3, actions: 3 }),
    lot("batch_decided", { seq: 3, decision: "reject", actions: 3 }),
  ]);
});

test("without a sink the store journals nothing and still works", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-pa-events-"));
  dirs.push(home);
  const store = openProjectAgentStore(home);
  const b = store.createBatch({
    id: "b1",
    projectId: "p1",
    runId: "r1",
    sessionId: "s1",
    summary: "Lot",
    actions,
    expected: [],
    createdAt: 1,
  });
  expect(store.appendBatchEvent(b.id, { type: "superseded" }, 2).status).toBe("superseded");
});
