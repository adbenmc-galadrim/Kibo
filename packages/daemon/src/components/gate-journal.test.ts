import { expect, spyOn, test } from "bun:test";
import { type Instance, KiboError } from "@kibo/schema";
import { createGate } from "./gate";
import { idleHandlers, instances, refused, testGate } from "./gate-test-kit";
import { createQuotas } from "./quotas";

test("refusals raised by handlers are journaled too", async () => {
  const { events } = testGate();
  const deny = createGate({
    instance: () => instances.builtin as Instance,
    handlers: {
      ...idleHandlers,
      data: async () => {
        throw new KiboError("QUOTA_EXCEEDED", "too big");
      },
      fetch: async () => {
        throw new KiboError("PERMISSION_DENIED", "private address");
      },
    },
    quotas: createQuotas(),
    events,
  });
  await refused(deny.call("p1", "builtin", { kind: "data.set", key: "k", value: 1 }), "QUOTA_EXCEEDED");
  await refused(
    deny.call("p1", "builtin", {
      kind: "fetch",
      url: "https://api.github.com/graphql",
      init: { method: "GET", headers: {} },
    }),
    "PERMISSION_DENIED",
  );
  expect(events.list().map((e) => e.code)).toEqual(["QUOTA_EXCEEDED", "PERMISSION_DENIED"]);
});

test("a journal failure never hides the refusal", async () => {
  const { gate: g, db } = testGate();
  db.close();
  const logged = spyOn(console, "error").mockImplementation(() => {});
  try {
    await refused(g.call("p1", "thirdparty", { kind: "list", entity: "link" }), "NOT_FOUND");
    expect(logged).toHaveBeenCalledTimes(1);
  } finally {
    logged.mockRestore();
  }
});

test("NOT_FOUND is journaled only when the instance itself is missing", async () => {
  const { events } = testGate();
  const missing = createGate({
    instance: () => instances.builtin as Instance,
    handlers: {
      ...idleHandlers,
      list: async () => {
        throw new KiboError("NOT_FOUND", "ticket t");
      },
    },
    quotas: createQuotas(),
    events,
  });
  await refused(missing.call("p1", "builtin", { kind: "list", entity: "ticket" }), "NOT_FOUND");
  expect(events.list()).toEqual([]);
});
