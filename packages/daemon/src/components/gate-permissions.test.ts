import { expect, test } from "bun:test";
import type { ComponentCall } from "@kibo/schema";
import { createEventLog } from "./events";
import { createGate } from "./gate";
import { eventsDb, findInstance, idleHandlers, refused, testGate } from "./gate-test-kit";
import { createQuotas } from "./quotas";

test("sharing.get and settings.get reach their handlers for the caller's project", async () => {
  const asked: string[] = [];
  const gate = createGate({
    instance: findInstance,
    quotas: createQuotas(),
    events: createEventLog(eventsDb()),
    handlers: {
      ...idleHandlers,
      sharing: async (projectId) => {
        asked.push(projectId);
        return { shared: false, keyAllocator: "local", role: null, access: "write", members: [] };
      },
      settings: async (projectId) => {
        asked.push(projectId);
        return { tracking: { openLimit: 3 }, agentExecution: "hidden" };
      },
    },
  });
  expect(await gate.call("p2", "builtin", { kind: "sharing.get" })).toMatchObject({ access: "write" });
  expect(await gate.call("p3", "builtin", { kind: "settings.get" })).toEqual({
    tracking: { openLimit: 3 },
    agentExecution: "hidden",
  });
  expect(asked).toEqual(["p2", "p3"]);
});

test("questions.recipients reaches the recipients handler", async () => {
  const { gate: g, handled } = testGate();
  expect(await g.call("p1", "builtin", { kind: "questions.recipients" })).toEqual([
    { id: "me", name: "Moi" },
  ]);
  expect(handled).toEqual(["recipients:p1"]);
});

test("run.peek is no longer connected", async () => {
  const peek: ComponentCall = { kind: "run.peek", runId: "r1" };
  const { gate: g, handled } = testGate();
  await refused(g.call("p1", "builtin", peek), "NOT_CONNECTED");
  expect(handled).toEqual([]);
});

test("a component never marks answers delivered", async () => {
  const mark: ComponentCall = {
    kind: "run",
    command: { method: "markAnswersDelivered", ticketId: "t1", questionIds: ["q1"], runId: "r1", at: 1 },
  };
  const { gate: g, handled } = testGate();
  await refused(g.call("p1", "builtin", mark), "PERMISSION_DENIED");
  expect(handled).toEqual([]);
});
