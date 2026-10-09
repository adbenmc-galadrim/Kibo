import { expect, test } from "bun:test";
import { BuiltinEntityType, type ComponentCall, type GrantedPermissions, type Instance } from "@kibo/schema";
import { createEventLog } from "./events";
import { createGate, missingPermission } from "./gate";
import { eventsDb, findInstance, granted, idleHandlers, instances, refused, testGate } from "./gate-test-kit";
import { createQuotas } from "./quotas";

test("missingPermission names what is lacking", () => {
  expect(missingPermission(granted, { kind: "list", entity: "status" })).toBe("read:status");
  expect(missingPermission(granted, { kind: "data.get", key: "k" })).toBeNull();
  expect(
    missingPermission(granted, {
      kind: "fetch",
      url: "https://api.github.com/graphql/x",
      init: { method: "GET", headers: {} },
    }),
  ).toBeNull();
});

test("reserved commands stay refused even with every write granted", () => {
  const everything: GrantedPermissions = { ...granted, writes: [...BuiltinEntityType.options] };
  const data: ComponentCall = {
    kind: "run",
    command: { method: "setInstanceData", instanceId: "thirdparty", key: "k", value: 1 },
  };
  const component: ComponentCall = {
    kind: "run",
    command: {
      method: "setInstanceComponent",
      instanceId: "thirdparty",
      component: "evil@0.2.0",
      config: {},
      data: null,
    },
  };
  expect(missingPermission(everything, data)).toBe("write:setInstanceData");
  expect(missingPermission(everything, component)).toBe("write:setInstanceComponent");
});

test("list(run) needs read:run and reaches the list handler", async () => {
  const { gate: g, db } = testGate();
  await refused(g.call("p1", "thirdparty", { kind: "list", entity: "run" }), "PERMISSION_DENIED");
  const withRuns = createGate({
    instance: () => instances.thirdparty as Instance,
    active: (ref) => ({ ref, trust: "sandboxed", granted: { ...granted, reads: ["run"] } }),
    handlers: { ...idleHandlers, list: async (_p, entity) => `list:${entity}` },
    quotas: createQuotas(),
    events: createEventLog(db),
  });
  expect(await withRuns.call("p1", "thirdparty", { kind: "list", entity: "run" })).toBe("list:run");
});

test("the granted secrets reach the fetch handler of a sandboxed component only", async () => {
  const seen: unknown[] = [];
  const secrets = [{ name: "github" as const, hosts: ["api.github.com"] }];
  const g = createGate({
    instance: findInstance,
    active: (ref) => ({ ref, trust: "sandboxed", granted: { ...granted, secrets } }),
    handlers: {
      ...idleHandlers,
      fetch: async (grant) => {
        seen.push(grant);
        return { status: 200, headers: {}, body: "" };
      },
    },
    quotas: createQuotas(),
    events: createEventLog(eventsDb(), () => 42),
  });
  const call: ComponentCall = {
    kind: "fetch",
    url: "https://api.github.com/graphql",
    init: { method: "GET", headers: {} },
  };
  await g.call("p", "thirdparty", call);
  await g.call("p", "builtin", call);
  expect(seen).toEqual([{ net: ["api.github.com/graphql"], secrets }, null]);
});

test("presence and sharing need read:ticket", () => {
  const statusOnly = { ...granted, reads: ["status" as const] };
  expect(missingPermission(statusOnly, { kind: "presence.list" })).toBe("read:ticket");
  expect(missingPermission(statusOnly, { kind: "sharing.get" })).toBe("read:ticket");
  expect(missingPermission(granted, { kind: "presence.list" })).toBeNull();
});

test("presence.list and sharing.get reach their handlers for the caller's project", async () => {
  const peers = [
    { deviceId: "d2", self: false, userId: "u-lea", name: "Léa", pageId: null, ticketId: null, runs: [] },
  ];
  const asked: string[] = [];
  const gate = createGate({
    instance: findInstance,
    active: (ref) => ({ ref, trust: "sandboxed", granted }),
    quotas: createQuotas(),
    events: createEventLog(eventsDb()),
    handlers: {
      ...idleHandlers,
      presence: async (projectId) => {
        asked.push(projectId);
        return peers;
      },
      sharing: async (projectId) => {
        asked.push(projectId);
        return { shared: true, keyAllocator: "server", role: "editor", access: "write", members: [] };
      },
    },
  });
  expect(await gate.call("p1", "thirdparty", { kind: "presence.list" })).toEqual(peers);
  expect(await gate.call("p2", "thirdparty", { kind: "sharing.get" })).toMatchObject({ shared: true });
  expect(asked).toEqual(["p1", "p2"]);
});

test("questions.deliver needs write:question and reaches the questions handler", async () => {
  const deliver: ComponentCall = { kind: "questions.deliver", ticketId: "t1" };
  const denied = testGate();
  await refused(denied.gate.call("p1", "thirdparty", deliver), "PERMISSION_DENIED");
  const allowed = testGate(createQuotas(), { ...granted, writes: ["question"] });
  expect(await allowed.gate.call("p1", "thirdparty", deliver)).toEqual({ sent: 1, runId: "r1" });
  expect(allowed.handled).toEqual(["questions:p1:t1"]);
});

test("a component reads and writes questions only with their permission, never marks them delivered", () => {
  const create: ComponentCall = {
    kind: "run",
    command: { method: "createQuestion", ticketId: "t1", title: "?", createdBy: { kind: "human", ref: "x" } },
  };
  const mark: ComponentCall = {
    kind: "run",
    command: { method: "markAnswersDelivered", ticketId: "t1", questionIds: ["q1"], runId: "r1", at: 1 },
  };
  expect(missingPermission(granted, { kind: "list", entity: "question" })).toBe("read:question");
  expect(missingPermission(granted, create)).toBe("write:question");
  const questions: GrantedPermissions = { ...granted, reads: ["question"], writes: ["question"] };
  expect(missingPermission(questions, { kind: "list", entity: "question" })).toBeNull();
  expect(missingPermission(questions, create)).toBeNull();
  expect(missingPermission(questions, mark)).toBe("write:markAnswersDelivered");
});
