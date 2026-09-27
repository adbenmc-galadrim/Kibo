import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { NO_PERMISSIONS, SECRET_MARKET_PUBLISHER } from "@kibo/schema";
import { generateKeyPair, keyFingerprint } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createMemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { marketPublisherInfo, marketStatuses } from "./summary";

let fake: FakeMarket;
let db: Database;
let market: MarketService;
let registry: ReturnType<typeof createMemoryRegistry>;

beforeEach(async () => {
  fake = await startFakeMarket();
  db = new Database(":memory:");
  registry = createMemoryRegistry();
  market = new MarketService({
    db: openMarketDb(db),
    get: createHttpGet({ allowLoopbackHttp: true, log: () => {} }),
    registry: registry.port,
    now: () => 1,
    notify: mock(() => {}),
    log: mock(() => {}),
    emit: () => {},
  });
});
afterEach(() => {
  fake.stop();
  db.close();
});

test("an installed marketplace version reports its source and the newer version", async () => {
  const v1 = await makeTestPackage({ id: "burndown", version: "0.1.0", manifest: { title: "Burndown" } });
  const v2 = await makeTestPackage({
    id: "burndown",
    version: "0.2.0",
    publisher: v1.publisher,
    manifest: { title: "Burndown" },
  });
  await fake.publish(v1.bytes);
  await fake.publish(v2.bytes);
  await market.addSource({ url: fake.url, publicKey: fake.publicKey });
  const base = {
    trust: "sandboxed" as const,
    granted: NO_PERMISSIONS,
    publishedAt: 0,
    autoUpdate: false,
    revoked: null,
  };
  registry.port.put("burndown", "Burndown", {
    ...base,
    version: "0.1.0",
    hash: v1.pkg.hash,
    origin: "marketplace",
    approvedHash: v1.pkg.hash,
    source: { sourceId: "equipe", publisherKey: v1.publisher.keys.publicKey },
  });
  registry.port.put("hello", "Hello", {
    ...base,
    version: "0.1.0",
    hash: "a".repeat(64),
    origin: "user",
    approvedHash: "a".repeat(64),
    source: null,
  });
  expect(marketStatuses(market, registry.port.installed)).toEqual([
    { id: "burndown", version: "0.1.0", sourceId: "equipe", sourceName: "Équipe", updateAvailable: "0.2.0" },
  ]);
});

test("the publisher identity is readable without exposing the private key", async () => {
  const secrets = createMemorySecretStore(createRedactor());
  expect(await marketPublisherInfo(secrets)).toBeNull();
  const { publicKey } = await generateKeyPair();
  await secrets.set(
    SECRET_MARKET_PUBLISHER,
    JSON.stringify({ name: "Adam", publicKey, privateKey: "SECRET" }),
  );
  const info = await marketPublisherInfo(secrets);
  expect(info).toEqual({ name: "Adam", fingerprint: await keyFingerprint(publicKey) });
  expect(JSON.stringify(info)).not.toContain("SECRET");
});
