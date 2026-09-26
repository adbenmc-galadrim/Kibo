import { afterEach, expect, test } from "bun:test";
import { MIGRATIONS_JS, SERVER_JS, TEST_MANIFEST } from "./backend-code.test-helper";
import { type Backends, createBackends } from "./backends";

const all: Backends[] = [];
afterEach(() => {
  for (const b of all.splice(0)) b.stopAll();
});

type Options = {
  trust?: "trusted" | "sandboxed" | null;
  server?: boolean;
  migrations?: boolean;
  verify?: () => Promise<void>;
};

function backends(opts: Options = {}) {
  const trust = opts.trust === undefined ? "sandboxed" : opts.trust;
  const b = createBackends({
    source: () =>
      trust === null
        ? null
        : {
            manifest: TEST_MANIFEST,
            trust,
            code: {
              server: opts.server === false ? null : SERVER_JS,
              migrations: opts.migrations === false ? null : MIGRATIONS_JS,
            },
          },
    verify: opts.verify ?? (async () => undefined),
    onCall: async () => [],
  });
  all.push(b);
  return b;
}

const req = { projectId: "p", instanceId: "i", config: {}, input: null };
const migration = { projectId: "p", instanceId: "i", from: 0, to: 1, config: {}, data: {} };

test("actions run in a sandboxed process or a trusted worker", async () => {
  expect(await backends().action("probe@0.1.0", { ...req, name: "ping" })).toBe("pong");
  expect(await backends({ trust: "trusted" }).action("probe@0.1.0", { ...req, name: "ping" })).toBe("pong");
});

test("an unapproved version has no backend", async () => {
  await expect(backends({ trust: null }).action("probe@0.1.0", { ...req, name: "ping" })).rejects.toThrow(
    "TRUST_REQUIRED",
  );
});

test("a malformed ref is refused before any lookup", async () => {
  let looked = false;
  const b = createBackends({
    source: () => {
      looked = true;
      return null;
    },
    verify: async () => undefined,
    onCall: async () => [],
  });
  all.push(b);
  await expect(b.action("../probe@0.1.0", { ...req, name: "ping" })).rejects.toThrow("INVALID_INPUT");
  await expect(b.describe("probe")).rejects.toThrow("INVALID_INPUT");
  expect(looked).toBe(false);
});

test("the hash is checked again before each launch", async () => {
  const b = backends({
    verify: async () => {
      throw new Error("TRUST_REQUIRED: tampered");
    },
  });
  await expect(b.action("probe@0.1.0", { ...req, name: "ping" })).rejects.toThrow("TRUST_REQUIRED");
});

test("a component without server.js has no action and no job", async () => {
  const b = backends({ server: false, migrations: false });
  await expect(b.action("probe@0.1.0", { ...req, name: "ping" })).rejects.toThrow("PERMISSION_DENIED");
  expect(await b.describe("probe@0.1.0")).toEqual({ actions: [], jobs: [] });
});

test("describe lists jobs, migrate runs the steps", async () => {
  const b = backends();
  expect((await b.describe("probe@0.1.0")).jobs).toEqual([{ name: "sync", everyMinutes: 5 }]);
  expect(await b.migrate("probe@0.1.0", migration)).toEqual({ config: { v: 1 }, data: {} });
});

test("without migrations.js the migration keeps config and data", async () => {
  const b = backends({ server: false, migrations: false });
  expect(await b.migrate("probe@0.1.0", { ...migration, config: { a: 1 }, data: { b: 2 } })).toEqual({
    config: { a: 1 },
    data: { b: 2 },
  });
});

test("a job runs through the backend", async () => {
  const b = backends({ trust: "trusted" });
  await b.runJob("probe@0.1.0", { projectId: "p", instanceId: "i", config: {}, job: "sync" });
  const failure = await b
    .runJob("probe@0.1.0", { projectId: "p", instanceId: "i", config: {}, job: "nope" })
    .then(
      () => null,
      (e: unknown) => e,
    );
  expect(failure).toMatchObject({ code: "NOT_FOUND" });
});

test("running backends are listed until they are stopped", async () => {
  const b = backends({ trust: "trusted" });
  expect(b.running()).toEqual([]);
  await b.action("probe@0.1.0", { ...req, name: "ping" });
  expect(b.running()).toEqual(["probe@0.1.0"]);
  b.stop("probe@0.1.0");
  expect(b.running()).toEqual([]);
});
