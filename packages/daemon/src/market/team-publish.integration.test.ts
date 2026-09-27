import { Database } from "bun:sqlite";
import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { osSandbox, validateComponent } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { NO_PERMISSIONS } from "@kibo/schema";
import { TeamMarket } from "@kibo/sync-server";
import { startTestSyncServer, type TestSyncServer } from "@kibo/sync-server/testing";
import { kpkgSourceFiles } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { openSyncDb } from "../collab/sync-db";
import { configureServer } from "../collab/sync-join";
import { createPublishLock } from "../components/publish-lock";
import { fakeBuild, okReport } from "../components/service.test-helper";
import { createComponentStore } from "../components/store";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { installFromMarket, writeSources } from "./install";
import { sandboxAvailable } from "./install.test-helper";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { type PublishDeps, publishToMarket } from "./publish";

const genericSuite = (dir: string) =>
  sandboxAvailable
    ? validateComponent(dir, { toolchain: DEV_TOOLCHAIN, conformanceOnly: true })
    : okReport(dir);

let server: TestSyncServer;
let home: string;
let caFile: string;

beforeAll(async () => {
  server = await startTestSyncServer({ market: { id: "equipe", name: "Équipe" } });
  home = mkdtempSync(join(tmpdir(), "kibo-team-"));
  caFile = join(home, "ca.pem");
  writeFileSync(caFile, server.caPem);
});
afterAll(async () => {
  await server.stop();
  rmSync(home, { recursive: true, force: true });
});

const sourceUrl = () => `${server.httpsUrl}/market/`;

function daemon(name: string) {
  const dir = join(home, name);
  const registry = createMemoryRegistry();
  const syncDb = openSyncDb(new Database(":memory:", { strict: true }));
  const secrets = createMemorySecretStore(createRedactor());
  const market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: false, ca: server.caPem, log: () => {} }),
    registry: registry.port,
    now: Date.now,
    notify: mock(() => {}),
    log: mock(() => {}),
    emit: () => {},
  });
  const store = createComponentStore({ home: dir, toolchain: DEV_TOOLCHAIN, build: fakeBuild });
  const publishDeps: PublishDeps = {
    store,
    registry: registry.port,
    market,
    secrets,
    syncConfig: () => syncDb.config(),
    caPem: async () => server.caPem,
    validate: genericSuite,
    lock: createPublishLock(),
    tmpRoot: join(dir, "tmp"),
    now: Date.now,
    log: () => {},
  };
  const connect = async (role: "publisher" | null) => {
    const code = await server.inviteAccount(name);
    await configureServer(
      { db: syncDb, secrets, fetchImpl: fetch, readFile: (path) => Bun.file(path).text() },
      { serverUrl: server.url, code, deviceName: name, caFile },
    );
    const config = syncDb.config();
    if (!config) throw new Error("sync not configured");
    const team = await TeamMarket.open(server.server.sdb, server.dataDir);
    if (!team) throw new Error("team market not initialised");
    if (role) team.grant(config.userId, role);
  };
  const addTeamSource = async () => {
    const probe = await market.probe(sourceUrl());
    await market.addSource({ url: sourceUrl(), publicKey: probe.publicKey });
    return probe;
  };
  const storeOwn = async (id: string, version: string) => {
    const made = await makeTestPackage({ id, version, manifest: { title: "Burndown" } });
    const src = join(dir, `src-${id}-${version}`);
    await writeSources(src, await kpkgSourceFiles(made.pkg));
    const stored = await store.put(src);
    registry.port.put(id, "Burndown", {
      version,
      hash: stored.hash,
      origin: "user",
      trust: "trusted",
      approvedHash: stored.hash,
      granted: NO_PERMISSIONS,
      publishedAt: 0,
      autoUpdate: false,
      source: null,
      revoked: null,
    });
    return stored.hash;
  };
  return { dir, registry, market, store, publishDeps, connect, addTeamSource, storeOwn };
}

test("a component published by A on the team source installs on B with full verification", async () => {
  const a = daemon("Adam");
  const b = daemon("Lea");
  await a.connect("publisher");
  const hash = await a.storeOwn("burndown", "0.1.0");
  const probe = await a.addTeamSource();

  const { serial } = await publishToMarket(a.publishDeps, {
    id: "burndown",
    version: "0.1.0",
    sourceId: probe.sourceId,
    publisherName: "Adam",
  });
  expect(serial).toBeGreaterThan(probe.serial);
  expect(a.market.hasVersion(probe.sourceId, "burndown", "0.1.0")).toBe(true);

  await b.addTeamSource();
  const hit = b.market.search({ query: "burndown" })[0];
  expect(hit?.publisher).toMatchObject({ name: "Adam", verified: true });
  const result = await installFromMarket(
    {
      market: b.market,
      store: b.store,
      registry: b.registry.port,
      validate: genericSuite,
      sandbox: sandboxAvailable ? osSandbox() : { ready: async () => {} },
      lock: createPublishLock(),
      tmpRoot: join(b.dir, "tmp"),
      log: () => {},
    },
    { sourceId: probe.sourceId, id: "burndown", version: "0.1.0" },
  );
  expect(result.hash).toBe(hash);
  expect(result.market.newPublisher).toBe(true);
  expect(b.registry.port.get("burndown", "0.1.0")).toMatchObject({ origin: "marketplace", trust: null });

  await expect(
    publishToMarket(a.publishDeps, { id: "burndown", version: "0.1.0", sourceId: probe.sourceId }),
  ).rejects.toThrow("VERSION_EXISTS");
  await a.storeOwn("burndown", "0.2.0");
  const next = await publishToMarket(a.publishDeps, {
    id: "burndown",
    version: "0.2.0",
    sourceId: probe.sourceId,
  });
  expect(next.serial).toBe(serial + 1);
});

test("a member without the publisher role is refused by the server", async () => {
  const c = daemon("Sam");
  await c.connect(null);
  await c.storeOwn("velocity", "0.1.0");
  const probe = await c.addTeamSource();
  await expect(
    publishToMarket(c.publishDeps, {
      id: "velocity",
      version: "0.1.0",
      sourceId: probe.sourceId,
      publisherName: "Sam",
    }),
  ).rejects.toThrow("FORBIDDEN");
});
