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
