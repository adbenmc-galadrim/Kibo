import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { createWorkspaceDoc, putRegistryVersion } from "@kibo/core";
import { type ComponentCall, ComponentManifest, grantedOf } from "@kibo/schema";
import { type Backends, createBackends } from "./backends";
import { createEventLog, ensureEventsTable } from "./events";
import { createFakeStore, storedVersion } from "./fake-store.test-helper";
import { createRegistryService } from "./registry-service";

const H = "a".repeat(64);
const REF = "probe@0.1.0";
const SERVER = `
module.exports.server = {
  actions: {},
  jobs: { sync: { everyMinutes: 5, run: async (ctx) => { await ctx.list("ticket"); } } },
};
`;
const all: Backends[] = [];
afterEach(() => {
  for (const b of all.splice(0)) b.stopAll();
});

test("a version revoked while its backend is being checked never runs its job", async () => {
  const manifest = ComponentManifest.parse({
    id: "probe",
    version: "0.1.0",
    kind: "widget",
    title: "Probe",
    reads: ["ticket"],
    writes: [],
  });
  const ws = createWorkspaceDoc();
  putRegistryVersion(ws, "probe", "Probe", {
    version: "0.1.0",
    hash: H,
    origin: "user",
    trust: "trusted",
    approvedHash: H,
    granted: grantedOf(manifest),
    publishedAt: 1,
    autoUpdate: false,
  });
  const store = createFakeStore();
  store.add(storedVersion(manifest, H, SERVER));
  await store.load("probe", "0.1.0", H);
  const checking = Promise.withResolvers<void>();
  let checks = 0;
  const db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  const registry = createRegistryService({
    workspace: ws,
    persistWorkspace: () => undefined,
    projects: () => [],
    store: {
      ...store,
      verify: async (id, version, hash) => {
        checks += 1;
        await checking.promise;
        return store.verify(id, version, hash);
      },
    },
    events: createEventLog(db),
    stopBackend: (ref) => backends.stop(ref),
    emit: () => undefined,
  });
  const calls: ComponentCall[] = [];
  const backends = createBackends({
    source: (ref) => registry.source(ref),
    verify: (ref) => registry.verify(ref),
    onCall: async (_p, _i, call) => {
      calls.push(call);
      return [];
    },
  });
  all.push(backends);
  const job = backends.runJob(REF, { projectId: "p", instanceId: "i", config: {}, job: "sync" });
  while (checks === 0) await Bun.sleep(1);
  registry.revoke("probe", "0.1.0");
  checking.resolve();
  await expect(job).rejects.toThrow();
  expect(calls).toEqual([]);
  expect(backends.running()).toEqual([]);
});
