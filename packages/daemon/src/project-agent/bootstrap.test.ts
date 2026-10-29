import { afterEach, expect, test } from "bun:test";
import {
  PLAN_METHODS,
  type PlanAction,
  PROJECT_AGENT_REF,
  type ProjectAgentSummary,
  type ProjectEventInput,
  type RunView,
} from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { startProjectAgent } from "./bootstrap";
import { type Harness, harness } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

function boot(events?: ProjectEventInput[]) {
  const h = harness();
  open.push(h);
  const attached: string[] = [];
  const project = runView({ id: "p-run", projectId: h.project.id, ticketId: null, state: "running" });
  const run: RunView = { ...project, kind: "project", profileId: PROJECT_AGENT_REF };
  h.agents.runs.push(run);
  h.agents.startProjectRun = () => run;
  const listeners = new Set<(run: RunView) => void>();
  const started = startProjectAgent({
    home: h.dir,
    service: {
      docs: h.service.docs,
      agentData: h.service.agentData,
      attachProjectAgent(port: { summaries(): ProjectAgentSummary[] }) {
        attached.push(`attach:${port.summaries().length}`);
        return () => attached.push("detach");
      },
    },
    notes: h.notes,
    settings: { get: () => null },
    orchestrator: () => ({
      ...h.agents,
      hooks: { verify: () => true, receive: () => null },
      onRunState(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
    notify: () => {},
    signals: h.signals,
    ...(events && {
      events: { record: (_projectId: string, event: ProjectEventInput) => events.push(event) },
    }),
  });
  const turnEnds = () => {
    for (const listener of listeners) listener({ ...run, state: "done" });
  };
  return { h, started, attached, run, turnEnds, listeners };
}

test("the project agent is wired to the real project data and tools, and detaches on stop", async () => {
  const { h, started, attached } = boot();
  h.ticket("Récepteur de hooks");
  expect(started.agent.view(h.project.id)).toMatchObject({ session: null, batches: [], past: [] });
  const run = started.agent.mcp.run("p-run");
  if (!run) throw new Error("p-run is not known");
  const sheet = await started.agent.mcp.call(run, "get_ticket", { key: "SILO-1" });
  expect(JSON.parse(sheet)).toMatchObject({ key: "SILO-1", title: "Récepteur de hooks", statusId: "todo" });
  await expect(started.agent.mcp.call(run, "propose_batch", {})).rejects.toThrow("INVALID_INPUT");
  h.signals.add(1, { projectId: h.project.id, title: "Tests du récepteur" });
  const listed = JSON.parse(await started.agent.mcp.call(run, "list_signals", {}));
  expect(listed).toMatchObject({ items: [{ ref: "sig:1", title: "Tests du récepteur" }], total: 1 });
  expect(started.agent.signals).toBe(h.signals);
  started.stop();
  expect(attached).toEqual(["attach:0", "detach"]);
});

test("with a journal, only the batch left at the end of the turn is journaled, and stop unsubscribes", async () => {
  const events: ProjectEventInput[] = [];
  const { h, started, run, turnEnds, listeners } = boot(events);
  h.ticket("Récepteur de hooks");
  started.agent.send(h.project.id, "Range le projet");
  await started.agent.turns.prepare(run, h.dir);
  const propose = (title: string) =>
    started.agent.mcp.call(run, "propose_batch", {
      summary: title,
      actions: [{ id: 1, why: "", type: "updateTicket", ticket: "SILO-1", title }],
    });
  await propose("Brouillon");
  await propose("Récepteur");
  expect(events).toEqual([]);
  turnEnds();
  expect(events.map((e) => [e.kind, e.data])).toEqual([["batch_proposed", { seq: 2, actions: 1 }]]);
  started.stop();
  expect(listeners.size).toBe(0);
});

test("the plan rpc is wired to the same project data", async () => {
  const { h, started } = boot();
  const actions: PlanAction[] = [
    { id: 1, why: "", type: "createTicket", ref: "new:1", title: "Tournée", feature: true },
  ];
  expect(new Set<string>(started.plan.rpc.methods)).toEqual(new Set(PLAN_METHODS));
  expect(
    await started.plan.rpc.handle({ method: "previewPlan", projectId: h.project.id, actions }, LOCAL_CONTEXT),
  ).toEqual({ ok: true, keys: { "new:1": "F1" } });
  const outcome = await started.plan.rpc.handle(
    { method: "applyPlan", projectId: h.project.id, actions },
    LOCAL_CONTEXT,
  );
  expect(outcome).toMatchObject({ problems: [], stoppedAt: null, created: [{ ref: "new:1", key: "F1" }] });
  expect(h.data.project(h.project.id).tickets.map((t) => t.title)).toEqual(["Tournée"]);
  started.stop();
});
