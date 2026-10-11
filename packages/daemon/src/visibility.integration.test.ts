import { afterEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AgentsState,
  ProjectSnapshot,
  Question,
  RunMoment,
  RunMomentsPage,
  RunPeek,
  RunView,
  TicketView,
} from "@kibo/schema";
import { releaseFakeRun, scenarioPath } from "./agents/fake-claude-scenario";
import { cleanupTmp, repo } from "./agents/git-test-kit";
import {
  assign,
  type Client,
  cleanDaemons,
  runIn,
  seed,
  startTestDaemon,
  waitFor,
} from "./moments/daemon-client.test-helper";

cleanDaemons();
afterEach(cleanupTmp);

const momentsOf = (c: Client, runId: string) => c.rpc<RunMomentsPage>({ method: "runMoments", runId });
const snapshotOf = (c: Client, projectId: string) =>
  c.rpc<ProjectSnapshot>({ method: "getProject", projectId });
const ticketOf = async (c: Client, projectId: string, ticketId: string): Promise<TicketView> => {
  const found = (await snapshotOf(c, projectId)).tickets.find((t) => t.id === ticketId);
  if (!found) throw new Error(`ticket ${ticketId} not found`);
  return found;
};
const broadcastOf = (c: Client, runId: string): RunMoment[] =>
  c.events.flatMap((e) =>
    typeof e === "object" &&
    e !== null &&
    Reflect.get(e, "type") === "run.moments" &&
    Reflect.get(e, "runId") === runId
      ? (Reflect.get(e, "moments") as RunMoment[])
      : [],
  );
const closed = (c: Client, runId: string, last: RunMoment["data"]["kind"]) =>
  waitFor(async () => {
    const page = await momentsOf(c, runId);
    return page.moments.at(-1)?.data.kind === last ? page : undefined;
  });

test("a ticket run writes its narrative, plan and report without a token", async () => {
  const c = await startTestDaemon({ scenario: scenarioPath("progress") });
  const folder = await repo();
  const s = await seed(c, { folder, workspace: "repo", title: "Valider le formulaire" });
  const run = await assign(c, s);
  await runIn(c, run.id, ["done"]);
  const ticket = await waitFor(async () => {
    const t = await ticketOf(c, s.project.id, s.ticket.id);
    return t.agentProgress.reports[0]?.check ? t : undefined;
  });
  const page = await closed(c, run.id, "message");
  expect(page.source).toBe("transcript");
  const data = page.moments.map((m) => m.data);
  const actionKinds = data.map((d) => (d.kind === "actions" ? d.actions.map((a) => a.kind) : d.kind));
  expect(actionKinds).toEqual([
    "message",
    ["read", "todo"],
    ["progress", "edit", "test"],
    "message",
    ["create"],
    ["progress"],
    "message",
  ]);
  expect(page.moments.map((m) => m.stepId)).toEqual([
    null,
    null,
    "valider",
    "valider",
    "valider",
    "tester",
    "tester",
  ]);
  expect(data[0]).toEqual({ kind: "message", text: "Je lis le formulaire." });
  const tested = data[2]?.kind === "actions" ? data[2] : null;
  expect(tested).toMatchObject({ failed: true, summary: expect.stringContaining("12 réussis, 1 échec") });
  expect(tested?.actions[1]).toMatchObject({ label: "A modifié `LoginForm.tsx` (+8 −3)", outcome: "ok" });
  expect(tested?.actions[2]).toMatchObject({ outcome: "error", tests: { passed: 12, failed: 1 } });
  expect(data[3]).toEqual({ kind: "message", text: "Un échec sur la validation vide. ‹masqué›" });
  expect(JSON.stringify(data)).not.toContain("ghp_");
  expect(page.internalPlan?.map((step) => step.status)).toEqual(["done", "doing", "todo"]);
  expect(ticket.agentProgress).toMatchObject({ planRunId: run.id });
  expect(ticket.agentProgress.plan).toHaveLength(5);
  expect(ticket.agentProgress.reports).toEqual([
    expect.objectContaining({
      runId: run.id,
      toCheck: ["Message d'erreur de l'e-mail vide", "Comportement hors ligne"],
      check: { undeclared: ["src/extra.ts"], unchanged: ["src/LoginForm.tsx"] },
    }),
  ]);
  const agents = await c.rpc<AgentsState>({ method: "getAgents" });
  expect(agents.progress).toEqual([
    {
      runId: run.id,
      step: { index: 3, total: 5, title: "Lancer les tests" },
      report: { toCheck: 2, undeclared: 1 },
    },
  ]);
  const peek = await c.rpc<RunPeek>({ method: "runPeek", runId: run.id });
  expect(peek).toMatchObject({ step: { index: 3, total: 5 }, state: "done" });
  expect(broadcastOf(c, run.id).map((m) => m.seq)).toEqual(page.moments.map((m) => m.seq));
}, 60_000);

test("a run without a plan is reminded once and its stop is blocked once", async () => {
  const c = await startTestDaemon({ scenario: scenarioPath("progress-no-plan") });
  const s = await seed(c);
  const run = await assign(c, s);
  const done = await runIn(c, run.id, ["done"]);
  const page = await closed(c, run.id, "actions");
  const reminders = page.moments.flatMap((m) => (m.data.kind === "reminder" ? [m.data.reminder] : []));
  expect(reminders).toEqual(["plan", "report"]);
  const ticket = await ticketOf(c, s.project.id, s.ticket.id);
  expect(ticket.agentProgress.reports).toEqual([
    expect.objectContaining({ runId: run.id, done: "Libellé du bouton corrigé.", check: null }),
  ]);
  const log = await c.rpc<
    { event: { type: string; payload?: { event: string; stopHookActive: boolean } } }[]
  >({
    method: "getRunLog",
    runId: run.id,
  });
  const stops = log.flatMap((e) =>
    e.event.payload?.event === "Stop" ? [e.event.payload.stopHookActive] : [],
  );
  expect(stops).toEqual([false, true]);
  expect(done.state).toBe("done");
}, 60_000);

test("ticket_progress refuses another run's token and the project tools", async () => {
  const c = await startTestDaemon({ scenario: scenarioPath("hold") });
  const s = await seed(c);
  const run = await assign(c, s);
  await runIn(c, run.id, ["running"]);
  const config = await waitFor(async () => {
    try {
      return readFileSync(join(c.home, "runs", run.id, "mcp.json"), "utf8");
    } catch {
      return undefined;
    }
  });
  const token = /"KIBO_RUN_TOKEN":\s*"([0-9a-f]{64})"/.exec(config)?.[1] ?? "";
  const post = (runId: string, bearer: string, body: unknown) =>
    fetch(`${c.daemon.url}/agent-mcp/${runId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const plan = { tool: "ticket_progress", input: { plan: [{ id: "a", title: "Lire", status: "doing" }] } };
  expect((await post(run.id, "f".repeat(64), plan)).status).toBe(401);
  expect((await post(run.id, token, { tool: "list_tickets", input: {} })).status).toBe(403);
  const accepted = await post(run.id, token, plan);
  expect(await accepted.json()).toEqual({ ok: true, text: "Plan enregistré." });
  expect((await ticketOf(c, s.project.id, s.ticket.id)).agentProgress.plan).toHaveLength(1);
  releaseFakeRun(join(c.home, "fake", "projects"), run.sessionId);
  await runIn(c, run.id, ["done"]);
  expect((await post(run.id, token, plan)).status).toBe(401);
}, 60_000);

test("a startable ticket loses the state while a run is active and the change is broadcast", async () => {
  const c = await startTestDaemon({ scenario: scenarioPath("hold") });
  const s = await seed(c);
  expect((await ticketOf(c, s.project.id, s.ticket.id)).startable).toBe(true);
  const run = await assign(c, s);
  await runIn(c, run.id, ["running"]);
  expect((await ticketOf(c, s.project.id, s.ticket.id)).startable).toBe(false);
  expect(c.events).toContainEqual({ projectId: s.project.id });
  releaseFakeRun(join(c.home, "fake", "projects"), run.sessionId);
  await runIn(c, run.id, ["done"]);
}, 60_000);

test("a question carries the recipient proposed by the agent", async () => {
  const c = await startTestDaemon({
    scenario: (home) => {
      const file = join(home, "ask-client.json");
      const input = {
        question: "Quel libellé ?",
        context: "Bouton d'envoi",
        options: ["A", "B"],
        provisional: "A",
        recipient: "Client",
      };
      const steps = [
        { hook: "PreToolUse", tool: "mcp__kibo__ask_question", input },
        { hook: "PostToolUse", tool: "mcp__kibo__ask_question", input },
      ];
      writeFileSync(file, JSON.stringify({ turns: [{ steps, result: "Livré.", tokens: 100 }] }));
      return file;
    },
  });
  const s = await seed(c);
  const run: RunView = await assign(c, s);
  await runIn(c, run.id, ["done"]);
  const question = await waitFor(async () => {
    const qs: Question[] = (await snapshotOf(c, s.project.id)).questions;
    return qs[0];
  });
  expect(question).toMatchObject({ title: "Quel libellé ?", recipient: "client" });
}, 60_000);
