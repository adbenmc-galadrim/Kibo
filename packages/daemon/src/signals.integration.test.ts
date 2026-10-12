import { expect, test } from "bun:test";
import { join } from "node:path";
import {
  type RunMomentsPage,
  type RunView,
  SIGNAL_WAKE_WINDOW_MS,
  type Signal,
  type SignalsView,
  type Ticket,
  WAKEUP_PREFIX,
} from "@kibo/schema";
import { releaseFakeRun } from "./agents/fake-claude-scenario";
import {
  agentsOf,
  decide,
  logOf,
  postMcp,
  type Rpc,
  runToken,
  type Seeded,
  type Stack,
  seedKibo,
  send,
  snapshotOf,
  startStack,
  turnDone,
  viewOf,
  waitFor,
} from "./project-agent/integration.test-helper";

type Kibo = Seeded & { keys: Map<string, Ticket> };

async function seedSixteen(rpc: Rpc): Promise<Kibo> {
  const seeded = await seedKibo(rpc);
  const keys = new Map<string, Ticket>([
    ["KIB-1", seeded.receiver],
    ["KIB-2", seeded.docs],
  ]);
  for (let n = 3; n <= 16; n++) {
    const ticket = await rpc<Ticket>({
      method: "command",
      projectId: seeded.project.id,
      command: { method: "createTicket", title: `Ticket ${n}`, statusId: "todo" },
    });
    keys.set(`KIB-${n}`, ticket);
  }
  return { ...seeded, keys };
}

function assign(rpc: Rpc, kibo: Kibo, key: string): Promise<RunView> {
  return rpc<RunView>({
    method: "assignAgent",
    projectId: kibo.project.id,
    ticketId: kibo.keys.get(key)?.id,
    profileId: kibo.opus.ref,
    brief: "",
  });
}

const signalsOf = (rpc: Rpc, projectId: string) => rpc<SignalsView>({ method: "listSignals", projectId });
const byRef = (view: SignalsView, ref: string): Signal | undefined => view.signals.find((s) => s.ref === ref);

const projectRuns = async (rpc: Rpc) => (await agentsOf(rpc)).runs.filter((r) => r.kind === "project");

async function wokenBatch(stack: Stack, projectId: string) {
  return waitFor(async () => {
    const view = await viewOf(stack.rpc, projectId);
    const batch = view.batches[0];
    return batch?.status === "pending" && view.session ? { batch, runId: view.session.runId } : undefined;
  });
}

async function running(rpc: Rpc, runId: string): Promise<RunView> {
  return waitFor(async () => (await agentsOf(rpc)).runs.find((r) => r.id === runId && r.state === "running"));
}

test("a ticket run signals, the project agent wakes up once and the batch settles the signals", async () => {
  const stack = await startStack("signal-routes");
  const kibo = await seedSixteen(stack.rpc);
  const projectId = kibo.project.id;
  const run = await assign(stack.rpc, kibo, "KIB-14");
  await turnDone(stack.rpc, run.id, 1);

  const opened = await signalsOf(stack.rpc, projectId);
  expect(opened.signals.map((s) => [s.ref, s.kind, s.ticketKey, s.runLabel])).toEqual([
    ["sig:3", "context", "KIB-14", run.label],
    ["sig:2", "blocker", "KIB-16", run.label],
    ["sig:1", "ticket", "KIB-14", run.label],
  ]);
  const moments = await stack.rpc<RunMomentsPage>({ method: "runMoments", runId: run.id });
  const signalMoments = moments.moments.flatMap((m) => (m.data.kind === "signal" ? [m.data] : []));
  expect(signalMoments.map((d) => [d.ref, d.signalKind])).toEqual([
    ["sig:1", "ticket"],
    ["sig:2", "blocker"],
    ["sig:3", "context"],
  ]);
  const actions = moments.moments.flatMap((m) => (m.data.kind === "actions" ? m.data.actions : []));
  expect(actions.filter((a) => a.kind === "signal").map((a) => a.label)).toContain(
    "A signalé « Tests du récepteur de hooks » à l'agent de projet",
  );
  expect(stack.notices).toContainEqual(
    expect.objectContaining({ title: `Blocage signalé par ${run.label}` }),
  );

  const { batch, runId: projectRunId } = await wokenBatch(stack, projectId);
  expect(await projectRuns(stack.rpc)).toHaveLength(1);
  const wakeups = (await logOf(stack.rpc, projectRunId)).flatMap((e) =>
    e.event.type === "answered" && e.event.text.startsWith(WAKEUP_PREFIX) ? [e.event.text] : [],
  );
  expect(wakeups).toHaveLength(1);
  expect(wakeups[0]).toStartWith(`${WAKEUP_PREFIX}1 signal à traiter (1 ticket à créer)`);
  expect(batch.actions.map((a) => (a.type === "dismissSignal" ? a.signal : a.signals))).toEqual([
    ["sig:1"],
    ["sig:2"],
    "sig:3",
  ]);
  const read = await signalsOf(stack.rpc, projectId);
  expect(byRef(read, "sig:1")).toMatchObject({ status: "read", readRunId: projectRunId });
  expect(read.wakeup.dueAt).toBe((read.wakeup.lastAt ?? 0) + SIGNAL_WAKE_WINDOW_MS);
  expect((await agentsOf(stack.rpc)).signals).toEqual([expect.objectContaining({ projectId, open: 3 })]);

  const decided = await decide(stack.rpc, {
    projectId,
    batchId: batch.id,
    decision: "apply",
    actionIds: [1, 2, 3],
  });
  expect(decided.results.map((r) => r.outcome)).toEqual(["applied", "applied", "applied"]);
  const snapshot = await snapshotOf(stack.rpc, projectId);
  const created = snapshot.tickets.find((t) => t.title === "Tests du récepteur de hooks");
  expect(created).toMatchObject({ key: "KIB-17", parentId: kibo.keys.get("KIB-14")?.id });
  expect(snapshot.tickets.find((t) => t.key === "KIB-16")?.statusId).toBe("blocked");
  const settled = await signalsOf(stack.rpc, projectId);
  expect(byRef(settled, "sig:1")).toMatchObject({ status: "handled", batchId: batch.id, actionId: 1 });
  expect(byRef(settled, "sig:2")).toMatchObject({ status: "handled", batchId: batch.id, actionId: 2 });
  expect(byRef(settled, "sig:3")).toMatchObject({ status: "ignored", batchId: batch.id, actionId: 3 });
  expect((await agentsOf(stack.rpc)).signals.filter((c) => c.open > 0)).toEqual([]);
  expect(settled.wakeup.lastAt).not.toBeNull();
}, 90_000);

test("a second trigger inside the window schedules one wake-up, not a second run", async () => {
  const stack = await startStack("signal-routes");
  const kibo = await seedSixteen(stack.rpc);
  const projectId = kibo.project.id;
  const first = await assign(stack.rpc, kibo, "KIB-14");
  await turnDone(stack.rpc, first.id, 1);
  const { runId } = await wokenBatch(stack, projectId);
  const before = await signalsOf(stack.rpc, projectId);

  const second = await assign(stack.rpc, kibo, "KIB-16");
  await turnDone(stack.rpc, second.id, 1);
  const after = await signalsOf(stack.rpc, projectId);
  expect(after.signals.filter((s) => s.runId === second.id)).toHaveLength(3);
  expect(after.wakeup).toEqual(before.wakeup);
  expect(after.wakeup.dueAt).toBe((after.wakeup.lastAt ?? 0) + SIGNAL_WAKE_WINDOW_MS);
  const runs = await projectRuns(stack.rpc);
  expect(runs.map((r) => [r.id, r.pendingAnswer])).toEqual([[runId, null]]);
}, 90_000);

test("signal_project refuses project runs, foreign tokens and the 21st signal", async () => {
  const stack = await startStack("signal-routes");
  const kibo = await seedSixteen(stack.rpc);
  const projectId = kibo.project.id;
  const signal = { tool: "signal_project", input: { kind: "context", title: "Hors champ" } };

  const projectRun = await running(stack.rpc, (await send(stack.rpc, projectId, "Tiens la ligne.")).id);
  const ticketRun = await running(stack.rpc, (await assign(stack.rpc, kibo, "KIB-13")).id);
  const projectToken = runToken(stack.home, projectRun.id);
  const ticketToken = runToken(stack.home, ticketRun.id);
  expect((await postMcp(stack.url, projectRun.id, projectToken, signal)).status).toBe(403);
  expect(
    (await postMcp(stack.url, ticketRun.id, ticketToken, { tool: "list_signals", input: {} })).status,
  ).toBe(403);
  expect((await postMcp(stack.url, ticketRun.id, projectToken, signal)).status).toBe(401);
  expect((await signalsOf(stack.rpc, projectId)).signals).toEqual([]);
  for (const r of [projectRun, ticketRun]) releaseFakeRun(join(stack.home, "fake"), r.sessionId);
  await turnDone(stack.rpc, ticketRun.id, 1);

  const spam = await assign(stack.rpc, kibo, "KIB-15");
  await turnDone(stack.rpc, spam.id, 1);
  const outcomes = stack.calls(spam.sessionId)[0]?.mcp.filter((c) => c.tool === "signal_project") ?? [];
  expect(outcomes.map((c) => c.isError)).toEqual([...Array(20).fill(false), true, true]);
  expect(outcomes.at(-1)?.text).toContain("20 signals at most");
  const listed = await signalsOf(stack.rpc, projectId);
  expect(listed.signals.filter((s) => s.runId === spam.id)).toHaveLength(20);
}, 90_000);

test("ignoring a signal from the box drops it from the prompt and the counts", async () => {
  const stack = await startStack("signal-routes");
  const kibo = await seedSixteen(stack.rpc);
  const projectId = kibo.project.id;
  const run = await assign(stack.rpc, kibo, "KIB-14");
  await turnDone(stack.rpc, run.id, 1);
  const { runId } = await wokenBatch(stack, projectId);
  await turnDone(stack.rpc, runId, 1);
  const context = byRef(await signalsOf(stack.rpc, projectId), "sig:3");

  const ignored = await stack.rpc<Signal>({ method: "ignoreSignal", projectId, signalId: context?.id });
  expect(ignored).toMatchObject({
    ref: "sig:3",
    status: "ignored",
    decidedBy: { kind: "human", ref: "adam" },
  });
  expect((await agentsOf(stack.rpc)).signals).toEqual([expect.objectContaining({ projectId, open: 2 })]);

  const next = await send(stack.rpc, projectId, "Range le projet.");
  await turnDone(stack.rpc, next.id, 2);
  const prompt = stack.calls(next.sessionId)[1]?.prompt ?? "";
  expect(prompt).toContain("## Signaux à traiter");
  expect(prompt).toContain("sig:1");
  expect(prompt).not.toContain("sig:3");
}, 90_000);
