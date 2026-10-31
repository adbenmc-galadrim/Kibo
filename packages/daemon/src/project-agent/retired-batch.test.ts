import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import { PROJECT_AGENT_REF, RETIRED_ACTION_DETAIL, type RunView } from "@kibo/schema";
import { runView } from "../questions/questions.test-helper";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { startProjectAgent } from "./bootstrap";
import { type Harness, harness, statusOf } from "./fakes.test-helper";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

function boot() {
  const h = harness();
  open.push(h);
  h.ticket("Accueil");
  h.ticket("Panneau", "in_progress");
  const project = runView({ id: "p-run", projectId: h.project.id, ticketId: null, state: "done" });
  const run: RunView = { ...project, kind: "project", profileId: PROJECT_AGENT_REF };
  h.agents.runs.push(run);
  h.agents.startProjectRun = () => run;
  h.agents.answer = (_runId, text) => ({ ...run, pendingAnswer: text });
  h.agents.log = () => [];
  const started = startProjectAgent({
    home: h.dir,
    service: {
      docs: h.service.docs,
      agentData: h.service.agentData,
      attachProjectAgent: () => () => undefined,
    },
    notes: h.notes,
    settings: { get: () => null },
    orchestrator: () => ({
      ...h.agents,
      hooks: { verify: () => true, receive: () => null },
      onRunState: () => () => undefined,
    }),
    notify: () => {},
  });
  return { h, started, run };
}

const STORED_ACTIONS = [
  {
    id: 1,
    why: "Le panneau est livré.",
    type: "setStatus",
    ticket: "SILO-2",
    statusId: "done",
    signals: ["sig:1"],
  },
  { id: 2, why: "L'agent opus est libre.", type: "assignAgent", ticket: "SILO-1", profileId: "global:opus" },
];

function storeBatch(home: string, run: RunView): void {
  const db = new Database(join(home, "runs.db"));
  try {
    db.query(
      "INSERT INTO project_agent_batches (id, project_id, run_id, session_id, seq, summary, actions, expected, " +
        "created_at) VALUES ('b1', $project, $run, $session, 1, 'Livrer le panneau', $actions, '[]', 10)",
    ).run({
      $project: run.projectId,
      $run: run.id,
      $session: run.sessionId,
      $actions: JSON.stringify(STORED_ACTIONS),
    });
  } finally {
    db.close();
  }
}

test("a stored batch with a retired assignAgent reads back, is shown, digests and applies its other action", async () => {
  const { h, started, run } = boot();
  const projectId = h.project.id;
  started.agent.send(projectId, "Où en est-on ?");
  await started.agent.turns.prepare(run, h.dir);
  storeBatch(h.dir, run);
  const shown = await started.agent.rpc.handle({ method: "getProjectAgent", projectId }, LOCAL_CONTEXT);
  expect(shown).toMatchObject({
    batches: [
      {
        id: "b1",
        status: "pending",
        actions: [
          { id: 1, why: "Le panneau est livré.", type: "setStatus", ticket: "SILO-2", statusId: "done" },
          {
            id: 2,
            why: "L'agent opus est libre.",
            type: "assignAgent",
            ticket: "SILO-1",
            profileId: "global:opus",
          },
        ],
      },
    ],
  });
  expect(started.agent.view(projectId).batches[0]?.actions[0]).not.toHaveProperty("signals");

  const decided = await started.agent.decide({ projectId, batchId: "b1", decision: "apply" });
  expect(decided.results).toEqual([
    { actionId: 1, outcome: "applied", detail: null, created: null },
    { actionId: 2, outcome: "skipped", detail: RETIRED_ACTION_DETAIL, created: null },
  ]);
  expect(decided.status).toBe("partial");
  expect(statusOf(h, "SILO-2")).toBe("done");
  expect(statusOf(h, "SILO-1")).toBe("todo");

  const next = await started.agent.turns.prepare({ ...run, turns: 1, pendingAnswer: "Et ensuite ?" }, h.dir);
  expect(next.prompt).toContain("Dernier lot : n° 1 — appliqué 1, périmé 0, échec 0, ignoré 1");
  started.stop();
});
