import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NO_PERMISSIONS } from "@kibo/schema";
import { generateKeyPair, keyFingerprint } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { createHttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";

let fake: FakeMarket;
let db: Database;
let registry: ReturnType<typeof createMemoryRegistry>;
let notify: ReturnType<typeof mock>;
let log: ReturnType<typeof mock>;
let emitted = 0;
let service: MarketService;
let now = 1_000;

const burndown = (version: string) =>
  makeTestPackage({
    id: "burndown",
    version,
    manifest: { title: "Burndown", description: "Graphe énergie du sprint", kind: "widget" },
  });

beforeEach(async () => {
  fake = await startFakeMarket();
  db = new Database(":memory:");
  registry = createMemoryRegistry();
  notify = mock((_: { title: string; body: string }) => {});
  log = mock((_m: string, _e: unknown) => {});
  emitted = 0;
  now = 1_000;
  service = new MarketService({
    db: openMarketDb(db),
    get: createHttpGet({ allowLoopbackHttp: true }),
    registry: registry.port,
    now: () => now,
    notify,
    log,
    emit: () => {
      emitted += 1;
    },
  });
});
afterEach(() => {
  fake.stop();
  db.close();
});

describe("sources", () => {
  test("probe reads the index and reports the announced key", async () => {
    await fake.publish((await burndown("0.1.0")).bytes);
    const probe = await service.probe(fake.url);
    expect(probe).toEqual({
      sourceId: "equipe",
      name: "Équipe",
      publicKey: fake.publicKey,
      fingerprint: await keyFingerprint(fake.publicKey),
      serial: 2,
      packages: 1,
    });
  });

  test("adding a source with another key is refused and stores nothing", async () => {
    const other = await generateKeyPair();
    await expect(service.addSource({ url: fake.url, publicKey: other.publicKey })).rejects.toThrow(
      "SIGNATURE_INVALID",
    );
    expect(service.listSources()).toEqual([]);
  });

  test("adding a source with a malformed key is refused before any download", async () => {
    const get = mock(createHttpGet({ allowLoopbackHttp: true }));
    const strict = new MarketService({
      db: openMarketDb(db),
      get,
      registry: registry.port,
      now: () => now,
      notify,
      log,
      emit: () => {},
    });
    await expect(strict.addSource({ url: fake.url, publicKey: "AAAA" })).rejects.toThrow("INVALID_INPUT");
    expect(get).not.toHaveBeenCalled();
    expect(strict.listSources()).toEqual([]);
  });

  test("a source whose id is not a valid source id is refused", async () => {
    const odd = await startFakeMarket({ id: "x".repeat(65) });
    try {
      await expect(service.addSource({ url: odd.url, publicKey: odd.publicKey })).rejects.toThrow(
        "INVALID_INPUT",
      );
      expect(service.listSources()).toEqual([]);
    } finally {
      odd.stop();
    }
  });

  test("the same source cannot be added twice", async () => {
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    await expect(service.addSource({ url: fake.url, publicKey: fake.publicKey })).rejects.toThrow(
      "already exists",
    );
  });

  test("an added source lists its fingerprint and serial", async () => {
    const info = await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    expect(info.id).toBe("equipe");
    expect(info.fingerprint).toBe(await keyFingerprint(fake.publicKey));
    expect(info.lastSerial).toBe(1);
    expect(service.listSources()).toHaveLength(1);
    expect(emitted).toBe(1);
    service.removeSource("equipe");
    expect(emitted).toBe(2);
  });

  test("an index with a lower serial is refused and the cache kept", async () => {
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    await fake.publish((await burndown("0.1.0")).bytes);
    await fake.publish((await burndown("0.2.0")).bytes);
    await service.refresh();
    await fake.setSerial(2);
    await service.refresh();
    const [source] = service.listSources();
    expect(source?.lastSerial).toBe(3);
    expect(source?.lastError).toContain("INDEX_ROLLBACK");
    expect(log).toHaveBeenCalled();
    expect(service.search({ query: "" })[0]?.latest).toBe("0.2.0");
  });

  test("an explicit refresh of one source rethrows its error", async () => {
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    await fake.setSerial(5);
    await service.refresh();
    await fake.setSerial(2);
    await expect(service.refresh("equipe")).rejects.toThrow("INDEX_ROLLBACK");
  });

  test("a probe of something that is not JSON is INVALID_INPUT", async () => {
    fake.tamper("index.json", new TextEncoder().encode("<html>"));
    await expect(service.probe(fake.url)).rejects.toThrow("INVALID_INPUT");
  });

  test("a source whose key changed is refused", async () => {
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    await fake.resignWith(await generateKeyPair());
    await service.refresh();
    expect(service.listSources()[0]?.lastError).toContain("SIGNATURE_INVALID");
  });
});

describe("revocation", () => {
  test("a revoked installed version loses its trust and notifies", async () => {
    const pkg = await burndown("0.1.0");
    await fake.publish(pkg.bytes);
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
    registry.port.put("burndown", "Burndown", {
      version: "0.1.0",
      hash: pkg.pkg.hash,
      origin: "marketplace",
      trust: "sandboxed",
      approvedHash: pkg.pkg.hash,
      granted: NO_PERMISSIONS,
      publishedAt: 0,
      autoUpdate: false,
      source: { sourceId: "equipe", publisherKey: pkg.publisher.keys.publicKey },
      revoked: null,
    });
    now = 5_000;
    await fake.revoke(pkg.pkg.hash, "Faille de sécurité");
    await service.refresh();
    expect(registry.revoked).toEqual([{ id: "burndown", version: "0.1.0", reason: "Faille de sécurité" }]);
    expect(registry.port.get("burndown", "0.1.0")?.revoked).toEqual({
      reason: "Faille de sécurité",
      at: 5_000,
    });
    expect(notify).toHaveBeenCalledWith({
      title: "Composant révoqué : Burndown",
      body: "Faille de sécurité",
    });
    await service.refresh();
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe("search and packages", () => {
  beforeEach(async () => {
    await fake.publish((await burndown("0.1.0")).bytes);
    await fake.publish(
      (
        await makeTestPackage({
          id: "roadmap",
          version: "1.0.0",
          manifest: { title: "Feuille de route", description: "Jalons du projet", kind: "view" },
        })
      ).bytes,
    );
    await service.addSource({ url: fake.url, publicKey: fake.publicKey });
  });

  test("search ignores case and accents on title, description and id", () => {
    expect(service.search({ query: "ENERGIE" }).map((h) => h.id)).toEqual(["burndown"]);
    expect(service.search({ query: "feuille" }).map((h) => h.id)).toEqual(["roadmap"]);
    expect(service.search({ query: "burn" }).map((h) => h.id)).toEqual(["burndown"]);
  });

  test("search filters by kind and by source", () => {
    expect(service.search({ query: "", kind: "view" }).map((h) => h.id)).toEqual(["roadmap"]);
    expect(service.search({ query: "", sourceId: "ailleurs" })).toEqual([]);
  });

  test("a newer version is offered as an update of the installed one", async () => {
    const installed = service.search({ query: "burn" })[0];
    registry.port.put("burndown", "Burndown", {
      version: "0.1.0",
      hash: "0".repeat(64),
      origin: "marketplace",
      trust: "sandboxed",
      approvedHash: "0".repeat(64),
      granted: NO_PERMISSIONS,
      publishedAt: 0,
      autoUpdate: false,
      source: { sourceId: "equipe", publisherKey: installed?.publisher.publicKey ?? "" },
      revoked: null,
    });
    await fake.publish((await burndown("0.2.0")).bytes);
    await service.refresh();
    const hit = service.search({ query: "burn" })[0];
    expect(hit?.installed).toBe("0.1.0");
    expect(hit?.updateAvailable).toBe("0.2.0");
  });

  test("the detail returns verified sources and flags a new publisher", async () => {
    const detail = await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" });
    expect(detail.files.map((f) => f.path)).toContain("ui.tsx");
    expect(detail.files.find((f) => f.path === "ui.tsx")?.content).toContain("export");
    expect(detail.newPublisher).toBe(true);
    expect(detail.publisherChanged).toBe(false);
    service.pinPublisher("equipe", "burndown", detail.publisher.publicKey);
    expect(
      (await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).newPublisher,
    ).toBe(false);
  });

  test("a changed publisher key is flagged in the detail and refused for install", async () => {
    const other = await generateKeyPair();
    service.pinPublisher("equipe", "burndown", other.publicKey);
    const detail = await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" });
    expect(detail.publisherChanged).toBe(true);
    expect(detail.pinnedPublisher).toBe(other.publicKey);
    await expect(
      service.fetchVerified({ sourceId: "equipe", id: "burndown", version: "0.1.0" }),
    ).rejects.toThrow("PUBLISHER_CHANGED");
    service.unpinPublisher({ sourceId: "equipe", componentId: "burndown" });
    expect(
      (await service.fetchVerified({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).newPublisher,
    ).toBe(true);
  });

  test("a tampered package is refused", async () => {
    fake.tamper("packages/burndown/0.1.0.kpkg", new TextEncoder().encode("{}"));
    await expect(
      service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" }),
    ).rejects.toThrow("INVALID_INPUT");
  });

  test("findSourceFor requires the same hash when one is given", async () => {
    const hash = (await service.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).hash;
    expect(service.findSourceFor({ id: "burndown", version: "0.1.0", hash })).toEqual({ sourceId: "equipe" });
    expect(service.findSourceFor({ id: "burndown", version: "0.1.0", hash: "f".repeat(64) })).toBeNull();
    expect(service.findSourceFor({ id: "burndown", version: "0.1.0", hash: null })).toEqual({
      sourceId: "equipe",
    });
    expect(service.findSourceFor({ id: "burndown", version: "9.9.9", hash: null })).toBeNull();
  });

  test("the cache survives a restart of the service", async () => {
    const again = new MarketService({
      db: openMarketDb(db),
      get: createHttpGet({ allowLoopbackHttp: true }),
      registry: registry.port,
      now: () => now,
      notify,
      log,
      emit: () => {},
    });
    fake.stop();
    await again.load();
    expect(
      again
        .search({ query: "" })
        .map((h) => h.id)
        .sort(),
    ).toEqual(["burndown", "roadmap"]);
  });
});
