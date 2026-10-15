import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { actionOf, DELIVERY_RPC_METHODS, type RunMoment, type RunView, Ticket } from "@kibo/schema";
import { testAgent, testAgentSource } from "../agents/agents-port.test-helper";
import { denialStore } from "../agents/denial-store";
import { CLAUDE_DENIAL_TEXT } from "../agents/fake-claude-transcript";
import type { Notice } from "../agents/notifier";
import type { AssignInput } from "../agents/orchestrator-types";
import { fakeAgentsPort } from "../agents-port.test-helper";
import { KIBO_COMMAND } from "../docs";
import { runView } from "../questions/questions.test-helper";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { call, createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { startDelivery } from "./bootstrap";

const opened: { home: string; store: Store; close(): void }[] = [];
afterEach(() => {
  for (const each of opened.splice(0)) {
    each.close();
    each.store.close();
    rmSync(each.home, { recursive: true, force: true });
  }
});

const refusal = (seq: number): RunMoment => ({
  id: seq,
  runId: "r1",
  seq,
  at: seq,
  stepId: null,
  data: {
    kind: "actions",
    actions: [
      actionOf({
        tool: "Bash",
        input: { command: "pnpm test" },
        output: CLAUDE_DENIAL_TEXT,
        isError: true,
        denied: true,
        patch: null,
      }),
    ],
    summary: "",
    failed: true,
  },
});

async function rig() {
  const home = mkdtempSync(join(tmpdir(), "kibo-delivery-boot-"));
  const store = openStore(home);
  const service: Service = createService(store, {
    user: "adam",
    agents: testAgentSource([testAgent({ id: "full-delivery", name: "full-delivery" })]).source,
  });
  const project = call(service, {
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  });
  const ticket = Ticket.parse(
    call(service, {
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title: "Accès refusé", statusId: "todo" },
    }),
  );
  const notices: Notice[] = [];
  const assigned: AssignInput[] = [];
  const run = runView({
    id: "r1",
    projectId: project.id,
    ticketId: ticket.id,
    ticketKey: "EMIS-1",
    turns: 1,
    state: "waiting_input",
  });
  const foreign = runView({ id: "r9", projectId: "gone", ticketId: "t9", state: "done" });
  const port = fakeAgentsPort([run, foreign]);
  const db = new Database(":memory:", { strict: true });
  const items = [
    { tool: "Bash", target: "pnpm test", rule: "Bash(pnpm *)", addDir: null, reason: "ok" as const },
  ];
  denialStore(db).save({ runId: "r9", turn: 1, items, questionId: "q9", seq: 1, at: 1 });
  const slots = join(home, "slots");
  const delivery = startDelivery({
    home,
    userHome: home,
    env: { DELIVERY_SLOTS: slots },
    notify: (notice) => notices.push(notice),
    service: () => service,
    notesDir: () => null,
    moments: () => ({
      page: () => ({ moments: [refusal(1)], internalPlan: null, partial: null, source: "transcript" }),
    }),
    agentSettings: () => ({
      settings: () => {
        throw new Error("not used");
      },
    }),
    orchestrator: () => ({
      ...port,
      assign: (input: AssignInput) => {
        assigned.push(input);
        return runView({ id: "r2", ticketId: input.ticketId, brief: input.brief });
      },
    }),
    db,
    alive: () => true,
  });
  opened.push({ home, store, close: delivery.close });
  return { service, project, ticket, run, port, delivery, notices, assigned, slots };
}

test("every delivery RPC method is served, the preset by the agent files and the rest here", async () => {
  const { delivery } = await rig();
  const served = [...delivery.rpc.flatMap((e) => e.methods), "agents.applyPreset"];
  expect([...served].sort()).toEqual([...DELIVERY_RPC_METHODS].sort());
});

test("Livrer on a leaf assigns the delivery agent through the RPC, with the brief written by Kibo", async () => {
  const { delivery, project, ticket, assigned } = await rig();
  const extension = delivery.rpc.find((e) => e.methods.includes("deliver"));
  await extension?.handle({ method: "deliver", projectId: project.id, ticketId: ticket.id }, LOCAL_CONTEXT);
  expect(assigned).toEqual([
    {
      projectId: project.id,
      ticketId: ticket.id,
      profileId: "global:full-delivery",
      brief: "/full-delivery EMIS-1",
      fresh: false,
    },
  ]);
  expect(await delivery.components.call(project.id, { kind: "run.deliveryAgent" })).toEqual({
    ref: "global:full-delivery",
    name: "full-delivery",
  });
});

test("a turn ended with refusals asks the denial question and notifies the human", async () => {
  const { delivery, run, notices, service, project } = await rig();
  await delivery.lifecycle({ onTurnEnd: async (_r: RunView) => {} }).onTurnEnd(run);
  const questions = call(service, { method: "getProject", projectId: project.id }).questions;
  expect(questions.map((q) => q.title)).toEqual(["1 action refusée pendant le run"]);
  expect(notices).toEqual([{ title: "EMIS-1 : 1 action refusée", body: "Kibo propose des règles" }]);
  const denials = await delivery.components.call(project.id, { kind: "run.denials", runId: run.id });
  expect(denials).toEqual(expect.objectContaining({ runId: "r1", questionId: questions[0]?.id }));
});

test("the agents state carries the delivery step of the ticket of an active run", async () => {
  const { delivery, port, service, project, ticket, run } = await rig();
  const step = { step: 7, note: "porte qualité", at: 1, runId: run.id };
  service.docs.run(
    project.id,
    { method: "setTicketDelivery", ticketId: ticket.id, delivery: step },
    KIBO_COMMAND,
  );
  expect(delivery.agents(port).state().delivery).toEqual([{ runId: "r1", step: 7, note: "porte qualité" }]);
});

test("the machine locks are read from the slots folder given by the environment", async () => {
  const { delivery, slots } = await rig();
  expect(delivery.locks()).toEqual([]);
  mkdirSync(join(slots, "heavy", "held"), { recursive: true });
  writeFileSync(join(slots, "heavy", "max"), "2");
  const ticket = { pid: 4101, since: 1, label: "emis:EMIS-15 gates", cwd: "/w", ticket: "1-4101" };
  writeFileSync(join(slots, "heavy", "held", "1-4101.json"), JSON.stringify(ticket));
  expect(delivery.locks()).toEqual([expect.objectContaining({ name: "heavy", max: 2 })]);
});

test("a component call on a run of another project is refused", async () => {
  const { delivery } = await rig();
  await expect(
    Promise.resolve().then(() => delivery.components.call("other", { kind: "run.denials", runId: "r1" })),
  ).rejects.toThrow("NOT_FOUND");
});

test("the denials of a run are read only when its project is served by this daemon", async () => {
  const { delivery } = await rig();
  const extension = delivery.rpc.find((e) => e.methods.includes("runs.denials"));
  const read = (runId: string) => extension?.handle({ method: "runs.denials", runId }, LOCAL_CONTEXT);
  await expect(read("r9")).rejects.toThrow("NOT_FOUND: run r9 not found");
  expect(await read("r1")).toBeNull();
});

test("Autoriser et relancer from a component of a remote session is refused", async () => {
  const { delivery } = await rig();
  const [guard] = delivery.handlers;
  const req = {
    method: "componentCall" as const,
    projectId: "p",
    instanceId: "i",
    call: { kind: "run.allowAndResume" as const, runId: "r1", questionId: "q1", rules: [], addDirs: [] },
  };
  await expect(guard?.(req, { sessionHash: "x", remote: true }) ?? Promise.resolve()).rejects.toThrow(
    "FORBIDDEN",
  );
  expect(await guard?.(req, LOCAL_CONTEXT)).toEqual({ handled: false });
});
