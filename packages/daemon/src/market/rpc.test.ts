import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { makeTestPackage } from "@kibo/trust/testing";
import { createPublishLock } from "../components/publish-lock";
import { fakeBuild, okReport } from "../components/service.test-helper";
import { createComponentStore } from "../components/store";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { createMarketRpc } from "./rpc";

let fake: FakeMarket;
let home: string;
let rpc: ReturnType<typeof createMarketRpc>;
const local = { sessionHash: "a".repeat(64), remote: false };
const remote = { sessionHash: "b".repeat(64), remote: true };

beforeEach(async () => {
  fake = await startFakeMarket();
  home = mkdtempSync(join(tmpdir(), "kibo-market-rpc-"));
  const registry = createMemoryRegistry().port;
  const market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true, log: () => {} }),
    registry,
    now: () => 1,
    notify: mock(() => {}),
    log: mock(() => {}),
    emit: () => {},
  });
  const store = createComponentStore({ home, toolchain: DEV_TOOLCHAIN, build: fakeBuild });
  const lock = createPublishLock();
  const tmpRoot = join(home, "tmp");
  rpc = createMarketRpc(
    market,
    {
      market,
      store,
      registry,
      validate: okReport,
      sandbox: { ready: async () => {} },
      lock,
      tmpRoot,
      log: () => {},
    },
    {
      store,
      registry,
      market,
      secrets: createMemorySecretStore(createRedactor()),
      syncConfig: () => null,
      caPem: async () => null,
      validate: okReport,
      lock,
      tmpRoot,
      now: () => 1,
      log: () => {},
    },
  );
});
afterEach(() => {
  fake.stop();
  rmSync(home, { recursive: true, force: true });
});

test("source changes and unpinPublisher are refused from a remote session", async () => {
  await expect(rpc({ method: "probeMarketSource", url: fake.url }, remote)).rejects.toThrow("FORBIDDEN");
  await expect(rpc({ method: "removeMarketSource", id: "equipe" }, remote)).rejects.toThrow("FORBIDDEN");
  await expect(
    rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey }, remote),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    rpc({ method: "unpinPublisher", sourceId: "equipe", componentId: "x" }, remote),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    rpc({ method: "installFromMarket", sourceId: "equipe", id: "burndown", version: "0.1.0" }, remote),
  ).rejects.toThrow("FORBIDDEN");
});

test("publishing and exporting a package are refused from a remote session", async () => {
  await expect(
    rpc({ method: "publishToMarket", id: "burndown", version: "0.1.0", sourceId: "equipe" }, remote),
  ).rejects.toThrow("FORBIDDEN");
  await expect(rpc({ method: "exportKpkg", id: "burndown", version: "0.1.0" }, remote)).rejects.toThrow(
    "FORBIDDEN",
  );
});

test("a local session reaches the publication", async () => {
  await expect(
    rpc({ method: "publishToMarket", id: "burndown", version: "0.1.0", sourceId: "equipe" }, local),
  ).rejects.toThrow("SYNC_OFFLINE");
  await expect(rpc({ method: "exportKpkg", id: "burndown", version: "0.1.0" }, local)).rejects.toThrow(
    "NOT_FOUND",
  );
});

test("a local session adds a source then lists it", async () => {
  await rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey }, local);
  const out = await rpc({ method: "listMarketSources" }, remote);
  expect(out.handled && Array.isArray(out.result) && out.result.length).toBe(1);
});

test("other methods are left to the next handler", async () => {
  expect(await rpc({ method: "listProjects" }, local)).toEqual({ handled: false });
});

test("refreshMarket answers null", async () => {
  expect(await rpc({ method: "refreshMarket" }, local)).toEqual({ handled: true, result: null });
});

test("findMarketSource answers null when nothing matches", async () => {
  expect(await rpc({ method: "findMarketSource", id: "x", version: "1.0.0", hash: null }, local)).toEqual({
    handled: true,
    result: null,
  });
});

test("installFromMarket answers the screen 30 target", async () => {
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0" });
  await fake.publish(made.bytes);
  await rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey }, local);
  const out = await rpc(
    { method: "installFromMarket", sourceId: "equipe", id: "burndown", version: "0.1.0" },
    local,
  );
  expect(out).toEqual({
    handled: true,
    result: {
      id: "burndown",
      title: "Burndown",
      version: "0.1.0",
      hash: made.pkg.hash,
      permissions: expect.objectContaining({ reads: ["ticket", "status"] }),
      market: { publisherName: "Léa", verified: true, sourceName: "Équipe", newPublisher: true },
    },
  });
});

test("the marketplace status and the publisher identity are readable from a remote session", async () => {
  expect(await rpc({ method: "listMarketStatus" }, remote)).toEqual({ handled: true, result: [] });
  expect(await rpc({ method: "getMarketPublisher" }, remote)).toEqual({ handled: true, result: null });
});
