import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { createMarketRpc } from "./rpc";

let fake: FakeMarket;
let rpc: ReturnType<typeof createMarketRpc>;
const local = { sessionHash: "a".repeat(64), remote: false };
const remote = { sessionHash: "b".repeat(64), remote: true };

beforeEach(async () => {
  fake = await startFakeMarket();
  const market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true }),
    registry: createMemoryRegistry().port,
    now: () => 1,
    notify: mock(() => {}),
    log: mock(() => {}),
    emit: () => {},
  });
  rpc = createMarketRpc(market);
});
afterEach(() => fake.stop());

test("addMarketSource and unpinPublisher are refused from a remote session", async () => {
  await expect(
    rpc({ method: "addMarketSource", url: fake.url, publicKey: fake.publicKey }, remote),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    rpc({ method: "unpinPublisher", sourceId: "equipe", componentId: "x" }, remote),
  ).rejects.toThrow("FORBIDDEN");
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
