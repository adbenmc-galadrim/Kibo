import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { MEMORY_NOTE_PATH, type ProposeBatchInput, type RunView } from "@kibo/schema";
import { GOOD_TOKEN, type Kit, PROJECT_ID, serviceKit } from "./service.test-helper";

let kit: Kit;
beforeEach(() => {
  kit = serviceKit();
});
afterEach(() => kit.cleanup());

const proposal = (statusId: "done" | "in_review" = "done", ticket = "EMIS-11"): ProposeBatchInput => ({
  summary: "Clore le panneau",
  actions: [{ id: 1, why: "livré", type: "setStatus", ticket, statusId }],
});

async function openTurn(text = "Où en est-on ?"): Promise<RunView> {
  const started = kit.svc.send(PROJECT_ID, text);
  await kit.svc.turns.prepare(started, kit.dir);
  return started;
}

test("send opens a session on the first message and resumes it after", () => {
  const first = kit.svc.send(PROJECT_ID, "Bonjour");
  expect(kit.store.openSession(PROJECT_ID)).toMatchObject({ runId: first.id, sessionId: first.sessionId });
  kit.svc.send(PROJECT_ID, "Et ensuite ?");
  expect(kit.calls).toEqual(["start:Emis:Bonjour", `answer:${first.id}:Et ensuite ?`]);
  kit.setWritable(false);
  expect(() => kit.svc.send(PROJECT_ID, "Encore")).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
});

test("prepare composes the first turn with the overview and the next turns with the digest", async () => {
  const run = kit.svc.send(PROJECT_ID, "Où en est-on ?");
  const turn1 = await kit.svc.turns.prepare(run, kit.dir);
  expect(turn1.prompt).toContain("# Projet");
  expect(turn1.prompt).toContain("Où en est-on ?");
  expect(turn1.cwd).toBe(join(kit.dir, "workspace"));
  expect(existsSync(turn1.cwd)).toBe(true);
  expect(kit.calls).toContain(`note:create:${MEMORY_NOTE_PATH}`);
  expect(kit.store.fingerprint(run.id)?.tickets.t11?.title).toBe("Panneau");
  const current = kit.current();
  kit.setProject({
    ...current,
    tickets: current.tickets.map((t) => (t.id === "t11" ? { ...t, title: "renommé" } : t)),
  });
  const folder = join(kit.dir, "code");
  mkdirSync(folder);
  kit.setFolder(folder);
  const turn2 = await kit.svc.turns.prepare({ ...run, turns: 1, pendingAnswer: "Et ensuite ?" }, kit.dir);
  expect(turn2.prompt).toContain("## Depuis ton dernier tour");
  expect(turn2.prompt).toContain("EMIS-11 · renommé");
  expect(turn2.prompt).toContain("Et ensuite ?");
  expect(turn2.systemPrompt).toContain("chef de projet du projet Emis");
  expect(turn2.cwd).toBe(folder);
  expect(kit.calls.filter((c) => c.startsWith("note:"))).toHaveLength(1);
});

test("propose validates, captures expected state, supersedes the previous pending batch and answers in French", async () => {
  const run = await openTurn();
  const emitted = kit.emits();
  expect(kit.svc.propose(run, proposal())).toBe("Lot 1 enregistré, en attente de validation d'adam.");
  const [first] = kit.store.batches(run.id);
  expect(first?.expected).toEqual([{ actionId: 1, fields: { statusId: "in_progress" } }]);
  expect(kit.svc.propose(run, proposal("in_review"))).toBe(
    "Lot 2 enregistré, en attente de validation d'adam.",
  );
  expect(kit.store.batches(run.id).map((b) => b.status)).toEqual(["superseded", "pending"]);
  const invalid = kit.svc.propose(run, proposal("done", "EMIS-999"));
  expect(invalid).toContain("#1 setStatus");
  expect(kit.store.batches(run.id)).toHaveLength(2);
  expect(kit.notices).toEqual([
    { title: "Lot à valider", body: "Agent de projet · Emis : lot n° 1" },
    { title: "Lot à valider", body: "Agent de projet · Emis : lot n° 2" },
  ]);
  expect(kit.emits() - emitted).toBe(2);
  expect(() => kit.svc.propose(run, { summary: "" })).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
});

test("decide apply runs ops.apply with the chosen ids and records the results; reject sends the comment as the next message", async () => {
  const run = await openTurn();
  kit.svc.propose(run, {
    summary: "Deux gestes",
    actions: [
      { id: 1, why: "livré", type: "setStatus", ticket: "EMIS-11", statusId: "done" },
      { id: 2, why: "commencer", type: "setStatus", ticket: "EMIS-1", statusId: "in_progress" },
    ],
  });
  const pending = kit.store.pendingBatch(PROJECT_ID);
  if (!pending) throw new Error("no pending batch");
  const decided = await kit.svc.decide({
    projectId: PROJECT_ID,
    batchId: pending.id,
    decision: "apply",
    actionIds: [2],
  });
  expect(kit.calls).toContain("apply:2:adam");
  expect(decided).toMatchObject({
    status: "partial",
    chosen: [2],
    decidedBy: { kind: "human", ref: "adam" },
  });
  expect(decided.results.map((r) => r.outcome)).toEqual(["skipped", "applied"]);
  await expect(
    kit.svc.decide({ projectId: PROJECT_ID, batchId: pending.id, decision: "reject" }),
  ).rejects.toMatchObject({
    code: "CONFLICT",
  });

  kit.svc.propose(run, proposal());
  const all = kit.store.pendingBatch(PROJECT_ID);
  if (!all) throw new Error("no pending batch");
  expect(await kit.svc.decide({ projectId: PROJECT_ID, batchId: all.id, decision: "apply" })).toMatchObject({
    status: "applied",
    chosen: [1],
  });

  kit.svc.propose(run, proposal());
  const silent = kit.store.pendingBatch(PROJECT_ID);
  if (!silent) throw new Error("no pending batch");
  const answers = () => kit.calls.filter((c) => c.startsWith("answer:"));
  expect(
    await kit.svc.decide({ projectId: PROJECT_ID, batchId: silent.id, decision: "reject" }),
  ).toMatchObject({
    status: "rejected",
  });
  expect(answers()).toEqual([]);

  kit.svc.propose(run, proposal());
  const commented = kit.store.pendingBatch(PROJECT_ID);
  if (!commented) throw new Error("no pending batch");
  await kit.svc.decide({
    projectId: PROJECT_ID,
    batchId: commented.id,
    decision: "reject",
    comment: "pas encore",
  });
  expect(answers()).toEqual([`answer:${run.id}:Lot 4 refusé : pas encore`]);
});

test("an apply that throws records every chosen action as failed", async () => {
  const run = await openTurn();
  kit.svc.propose(run, proposal());
  kit.setApply(async () => {
    throw new Error("disk gone");
  });
  const pending = kit.store.pendingBatch(PROJECT_ID);
  if (!pending) throw new Error("no pending batch");
  const decided = await kit.svc.decide({ projectId: PROJECT_ID, batchId: pending.id, decision: "apply" });
  expect(decided.status).toBe("partial");
  expect(decided.results).toEqual([{ actionId: 1, outcome: "failed", detail: "disk gone", created: null }]);
});

test("decide refuses unknown batches, action ids outside the batch and read-only projects", async () => {
  const run = await openTurn();
  kit.svc.propose(run, proposal());
  const pending = kit.store.pendingBatch(PROJECT_ID);
  if (!pending) throw new Error("no pending batch");
  const decide = (input: Partial<Parameters<typeof kit.svc.decide>[0]>) =>
    kit.svc.decide({ projectId: PROJECT_ID, batchId: pending.id, decision: "apply", ...input });
  await expect(decide({ batchId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(decide({ projectId: "other" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(decide({ actionIds: [9] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  kit.setWritable(false);
  await expect(decide({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(kit.store.pendingBatch(PROJECT_ID)?.id).toBe(pending.id);
});

test("reset closes the session, abandons the pending batch, and the next message starts a fresh run", async () => {
  const run = await openTurn();
  kit.svc.propose(run, proposal());
  const view = kit.svc.reset(PROJECT_ID);
  expect(view.session).toBeNull();
  expect(view.past.map((s) => s.runId)).toEqual([run.id]);
  expect(kit.store.batches(run.id).map((b) => b.status)).toEqual(["abandoned"]);
  expect(kit.calls).toContain(`cancel:${run.id}`);
  const next = kit.svc.send(PROJECT_ID, "On repart");
  expect(next.id).not.toBe(run.id);
  expect(kit.calls.filter((c) => c.startsWith("start:"))).toHaveLength(2);
});

test("view returns the current session, its run, its batches and the past sessions; a past runId is read-only", async () => {
  expect(kit.svc.view(PROJECT_ID)).toEqual({
    session: null,
    run: null,
    batches: [],
    past: [],
    memoryPath: MEMORY_NOTE_PATH,
  });
  const old = await openTurn();
  kit.svc.propose(old, proposal());
  kit.svc.reset(PROJECT_ID);
  const fresh = await openTurn("Nouveau départ");
  const view = kit.svc.view(PROJECT_ID);
  expect(view.session?.runId).toBe(fresh.id);
  expect(view.run?.id).toBe(fresh.id);
  expect(view.batches).toEqual([]);
  expect(view.past.map((s) => s.runId)).toEqual([old.id]);
  const past = kit.svc.view(PROJECT_ID, old.id);
  expect(past.session?.runId).toBe(old.id);
  expect(past.batches.map((b) => b.status)).toEqual(["abandoned"]);
  expect(() => kit.svc.view(PROJECT_ID, "unknown")).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  expect(() => kit.svc.propose(old, proposal())).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  kit.setWritable(false);
  expect(() => kit.svc.view(PROJECT_ID)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
});

test("summaries list one entry per project with an open session, with pendingBatchId", async () => {
  expect(kit.svc.summaries()).toEqual([]);
  const run = await openTurn();
  expect(kit.svc.summaries()).toEqual([
    { projectId: PROJECT_ID, runId: run.id, state: "queued", pendingBatchId: null },
  ]);
  kit.svc.propose(run, proposal());
  expect(kit.svc.summaries()[0]?.pendingBatchId).toBe(kit.store.pendingBatch(PROJECT_ID)?.id ?? "missing");
});

test("the MCP sink accepts only a live project run token and hands the run to the tools", async () => {
  const run = await openTurn();
  const ticketRun = { ...run, id: crypto.randomUUID(), kind: "ticket" as const };
  kit.runs.set(ticketRun.id, ticketRun);
  expect(kit.svc.mcp.verify(run.id, "b".repeat(64))).toBe(false);
  expect(kit.svc.mcp.verify(run.id, GOOD_TOKEN)).toBe(true);
  expect(() => kit.svc.mcp.verify(ticketRun.id, GOOD_TOKEN)).toThrow("not a project run");
  expect(await kit.svc.mcp.call(run.id, { tool: "list_tickets", input: {} })).toBe(`list_tickets:${run.id}`);
  await expect(kit.svc.mcp.call(ticketRun.id, { tool: "list_tickets", input: {} })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
