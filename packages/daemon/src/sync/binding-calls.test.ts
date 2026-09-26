import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { type Binding, ComponentManifest } from "@kibo/schema";
import { createEventLog, ensureEventsTable } from "../components/events";
import { createQuotas } from "../components/quotas";
import { BINDING_FETCH_PER_MINUTE, createBindingCalls } from "./binding-calls";

const manifest = ComponentManifest.parse({
  id: "github-issues",
  version: "1.0.0",
  kind: "adapter",
  title: "GitHub Issues",
  reads: ["ticket", "status"],
  writes: [],
  net: ["api.github.com"],
  secrets: [{ name: "github", hosts: ["api.github.com"] }],
});
const binding = (id: string): Binding => ({
  id,
  adapter: "github-issues",
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  createdBy: "adam",
  runner: "adam",
});
const FETCH = {
  kind: "fetch" as const,
  url: "https://api.github.com/user",
  init: { method: "GET" as const, headers: {} },
};

function setup() {
  const clock = { now: 0 };
  const db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  const refusals = createEventLog(db, () => clock.now);
  const fetched: string[] = [];
  const calls = createBindingCalls({
    bindings: (projectId) => (projectId === "p1" ? [binding("b1"), binding("b2")] : []),
    manifest,
    quotas: createQuotas({ now: () => clock.now, fetchPerMinute: BINDING_FETCH_PER_MINUTE }),
    refusals,
    fetch: async (_manifest, url) => {
      fetched.push(url);
      return { status: 200, headers: {}, body: "" };
    },
  });
  return { calls, fetched, refusals, clock };
}

test("an adapter may only fetch, for a binding of the project, and refusals are journaled", async () => {
  const { calls, fetched, refusals } = setup();
  await calls("p1", "binding:b1", FETCH);
  expect(fetched).toEqual(["https://api.github.com/user"]);
  await expect(calls("p1", "binding:b1", { kind: "list", entity: "ticket" })).rejects.toThrow(
    "PERMISSION_DENIED",
  );
  await expect(
    calls("p1", "binding:b1", { kind: "run", command: { method: "createTicket", title: "x" } }),
  ).rejects.toThrow("PERMISSION_DENIED");
  await expect(calls("p1", "binding:inconnu", FETCH)).rejects.toThrow("NOT_FOUND");
  await expect(calls("p2", "binding:b1", FETCH)).rejects.toThrow("NOT_FOUND");
  refusals.flush();
  expect(refusals.list().map((e) => [e.instanceId, e.kind, e.code])).toEqual([
    ["binding:b1", "list", "PERMISSION_DENIED"],
    ["binding:b1", "run", "PERMISSION_DENIED"],
    ["binding:inconnu", "fetch", "NOT_FOUND"],
    ["binding:b1", "fetch", "NOT_FOUND"],
  ]);
  expect(fetched).toHaveLength(1);
});

test("120 fetches per minute per binding", async () => {
  const { calls, clock } = setup();
  for (let i = 0; i < BINDING_FETCH_PER_MINUTE; i++) await calls("p1", "binding:b1", FETCH);
  await expect(calls("p1", "binding:b1", FETCH)).rejects.toThrow("RATE_LIMITED");
  await expect(calls("p1", "binding:b2", FETCH)).resolves.toBeDefined();
  clock.now += 60_000;
  await expect(calls("p1", "binding:b1", FETCH)).resolves.toBeDefined();
});
