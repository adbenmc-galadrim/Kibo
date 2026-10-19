import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { denialStore } from "../agents/denial-store";
import { fakeAgentsPort } from "../agents-port.test-helper";
import { allowAndResume } from "../delivery/allow-resume";
import { componentDelivery, type DeliveryCall } from "../delivery/component-calls";
import { deliver } from "../delivery/deliver";
import type { DeliveryOps } from "../delivery/delivery-ops";
import { runView } from "../questions/questions.test-helper";
import { createGateHandlers } from "./gate-handlers";
import { stubHandlerDeps, unused } from "./gate-test-kit";

const waiting = runView({ id: "r1", state: "waiting_input" });
const removed = { ...fakeAgentsPort([waiting]), ticketExecution: () => "removed" as const };

const ops: DeliveryOps = {
  deliverDeps: unused,
  deliver: (projectId, ticketId, mode) =>
    deliver({ project: unused, agents: unused, orchestrator: removed }, { projectId, ticketId, mode }),
  deliveryAgent: () => null,
  run: () => ({ ...waiting, projectId: "p1" }),
  denials: () => null,
  allowAndResume: (input) =>
    allowAndResume(
      {
        agents: { agentOf: unused, settings: unused },
        questions: { get: unused, answer: unused, markDelivered: unused },
        orchestrator: removed,
        denials: denialStore(new Database(":memory:", { strict: true })),
        viewer: () => "adam",
        home: "/home/adam",
      },
      input,
    ),
};

test("a component cannot deliver nor resume a run once ticket agents are removed", async () => {
  const handlers = createGateHandlers({
    ...stubHandlerDeps,
    delivery: componentDelivery(ops),
  });
  await expect(handlers.delivery("p1", { kind: "run.deliver", ticketId: "t1" })).rejects.toThrow(
    "AGENT_EXECUTION_REMOVED",
  );
  const allow: DeliveryCall = {
    kind: "run.allowAndResume",
    runId: "r1",
    questionId: "q1",
    rules: [],
    addDirs: [],
  };
  await expect(handlers.delivery("p1", allow)).rejects.toThrow("AGENT_EXECUTION_REMOVED");
  expect("questions" in handlers).toBe(false);
});
