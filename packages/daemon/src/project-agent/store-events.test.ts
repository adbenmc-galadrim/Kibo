import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectEventInput, ProposedAction, RunState } from "@kibo/schema";
import { createBatchJournal } from "./batch-journal";
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
type Recorded = { projectId: string; event: ProjectEventInput };
type Listener = (run: { id: string; state: RunState }) => void;

function open() {
  const home = mkdtempSync(join(tmpdir(), "kibo-pa-events-"));
  dirs.push(home);
  const recorded: Recorded[] = [];
  const listeners = new Set<Listener>();
  const run = { turn: 0 };
  const journal = createBatchJournal({
    events: { record: (projectId, event) => recorded.push({ projectId, event }) },
    turnOf: () => run.turn,
    onRunState(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  const store = openProjectAgentStore(home, journal);
  let id = 0;
  const propose = () => {
    const pending = store.pendingBatch("p1");
    if (pending) store.appendBatchEvent(pending.id, { type: "superseded" }, 1);
    id += 1;
    return store.createBatch({
      id: `b${id}`,
      projectId: "p1",
      runId: "r1",
      sessionId: "s1",
      summary: "Fin de S42",
      actions,
      expected: [],
      createdAt: 1,
    });
  };
  const state = (s: RunState) => {
    for (const listener of listeners) listener({ id: "r1", state: s });
  };
  const endTurn = () => {
    state("done");
    run.turn += 1;
    state("queued");
    state("running");
  };
  return { store, recorded, journal, propose, endTurn, state, run };
}

const lot = (kind: ProjectEventInput["kind"], data: ProjectEventInput["data"]): Recorded => ({
  projectId: "p1",
  event: { kind, ticketId: null, featureId: null, source: "project-agent", data },
});
const decided = { type: "decided", by: ADAM, comment: null } as const;

test("seven batches proposed in one turn journal only the last one, at the end of the turn", () => {
  const w = open();
  w.state("running");
  for (let i = 0; i < 7; i += 1) w.propose();
  expect(w.recorded).toEqual([]);
  w.endTurn();
  expect(w.recorded).toEqual([lot("batch_proposed", { seq: 7, actions: 3 })]);
});

test("a batch superseded by a later turn keeps its line", () => {
  const w = open();
  w.state("running");
  w.propose();
  w.endTurn();
  w.propose();
  w.state("done");
  expect(w.recorded).toEqual([
    lot("batch_proposed", { seq: 1, actions: 3 }),
    lot("batch_proposed", { seq: 2, actions: 3 }),
  ]);
});

test("a batch decided during its turn is journaled before its decision; the next draft waits", () => {
  const w = open();
  w.state("running");
  w.propose();
  const kept = w.propose();
  w.store.appendBatchEvent(kept.id, { ...decided, decision: "apply", actionIds: [1, 3] }, 2);
  w.store.appendBatchEvent(kept.id, { type: "results", results: [] }, 3);
  w.propose();
  w.propose();
  expect(w.recorded).toEqual([
    lot("batch_proposed", { seq: 2, actions: 3 }),
    lot("batch_decided", { seq: 2, decision: "apply", actions: 2 }),
  ]);
  w.state("failed");
  expect(w.recorded.slice(2)).toEqual([lot("batch_proposed", { seq: 4, actions: 3 })]);
});

test("a decision after the turn, a rejection and an abandon journal what they must", () => {
  const w = open();
  w.state("running");
  const first = w.propose();
  w.endTurn();
  w.store.appendBatchEvent(first.id, { ...decided, decision: "reject", actionIds: null }, 5);
  const second = w.propose();
  w.store.appendBatchEvent(second.id, { type: "abandoned" }, 6);
  w.state("cancelled");
  expect(w.recorded).toEqual([
    lot("batch_proposed", { seq: 1, actions: 3 }),
    lot("batch_decided", { seq: 1, decision: "reject", actions: 3 }),
    lot("batch_proposed", { seq: 2, actions: 3 }),
  ]);
});

test("a missed turn end is caught by the turn number of the next proposal", () => {
  const w = open();
  w.propose();
  w.run.turn += 1;
  w.propose();
  expect(w.recorded).toEqual([lot("batch_proposed", { seq: 1, actions: 3 })]);
});

test("closing the journal stops watching the runs", () => {
  const w = open();
  w.propose();
  w.journal.close();
  w.state("done");
  expect(w.recorded).toEqual([]);
});

test("without a journal the store journals nothing and still works", () => {
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
