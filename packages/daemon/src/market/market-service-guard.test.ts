import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { grantedOf, type MarketIndex } from "@kibo/schema";
import { generateKeyPair, type KeyPair, signIndex, utf8 } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createMemoryRegistry } from "../testing/memory-registry";
import type { HttpGet } from "./http-get";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";

type Signed = { bytes: Uint8Array; sig: Uint8Array };
type Served = { index: Signed; files?: Map<string, Uint8Array> };

const SOURCE = "https://m.example/";
let keys: KeyPair;
let db: Database;

async function signed(id: string, serial: number, packages: MarketIndex["packages"] = []): Promise<Signed> {
  const index: MarketIndex = {
    format: 1,
    source: { id, name: id, publicKey: keys.publicKey },
    serial,
    generatedAt: new Date(0).toISOString(),
    publishers: [],
    packages,
    revoked: [],
  };
  const s = await signIndex(index, keys.privateKey);
  return { bytes: s.bytes, sig: utf8(s.sig) };
}

function serve(current: () => Served) {
  return mock<HttpGet>(async (url) => {
    const served = current();
    if (url === `${SOURCE}index.json`) return served.index.bytes;
    if (url === `${SOURCE}index.json.sig`) return served.index.sig;
    const file = served.files?.get(url);
    if (!file) throw new Error(`unexpected ${url}`);
    return file;
  });
}

function service(get: HttpGet): MarketService {
  return new MarketService({
    db: openMarketDb(db),
    get,
    registry: createMemoryRegistry().port,
    now: () => 1,
    notify: () => {},
    log: () => {},
    emit: () => {},
  });
}

beforeEach(async () => {
  keys = await generateKeyPair();
  db = new Database(":memory:");
});

describe("index freshness", () => {
  test("concurrent refreshes cannot move the serial backwards", async () => {
    const v1 = await signed("equipe", 1);
    const v5 = await signed("equipe", 5);
    const v6 = await signed("equipe", 6);
    let refreshes = 0;
    let last = v1;
    const get = mock<HttpGet>(async (url) => {
      if (url.endsWith(".sig")) return last.sig;
      if (refreshes === 0) return v1.bytes;
      refreshes += 1;
      if (refreshes === 2) {
        await Bun.sleep(80);
        last = v5;
        return v5.bytes;
      }
      last = v6;
      return v6.bytes;
    });
    const market = service(get);
    await market.addSource({ url: SOURCE, publicKey: keys.publicKey });
    refreshes = 1;
    const slow = market.refresh();
    await Bun.sleep(10);
    await Promise.all([slow, market.refresh()]);
    expect(market.listSources()[0]?.lastSerial).toBe(6);
    expect(market.listSources()[0]?.lastError).toBeNull();
  });

  test("a refresh refuses the index of another source signed by the same key", async () => {
    let served: Served = { index: await signed("equipe", 1) };
    const market = service(serve(() => served));
    await market.addSource({ url: SOURCE, publicKey: keys.publicKey });
    served = { index: await signed("autre", 9) };
    await expect(market.refresh("equipe")).rejects.toThrow("SIGNATURE_INVALID");
    expect(market.listSources()[0]?.lastSerial).toBe(1);
  });

  test("a cached index of another source is refused at load", async () => {
    const market = service(serve(() => ({ index: { bytes: new Uint8Array(), sig: new Uint8Array() } })));
    const other = await signed("autre", 3);
    const marketDb = openMarketDb(db);
    marketDb.addSource({
      id: "equipe",
      url: SOURCE,
      name: "Équipe",
      publicKey: keys.publicKey,
      fingerprint: "f",
      lastSerial: null,
      lastFetchedAt: null,
      enabled: true,
      lastError: null,
    });
    marketDb.setFetched("equipe", {
      serial: 3,
      bytes: other.bytes,
      sig: new TextDecoder().decode(other.sig),
      at: 1,
    });
    await market.load();
    expect(market.listSources()[0]?.lastError).toContain("SIGNATURE_INVALID");
    expect(market.findSourceFor({ id: "burndown", version: "0.1.0", hash: null })).toBeNull();
  });
});

describe("source urls", () => {
  test("credentials in a source url are refused before any download", async () => {
    const get = serve(() => ({ index: { bytes: new Uint8Array(), sig: new Uint8Array() } }));
    const market = service(get);
    await expect(market.probe("https://lea:secret@m.example/")).rejects.toThrow("INVALID_INPUT");
    await expect(
      market.addSource({ url: "https://lea@m.example/", publicKey: keys.publicKey }),
    ).rejects.toThrow("INVALID_INPUT");
    expect(get).not.toHaveBeenCalled();
  });

  test("a malformed source url is INVALID_INPUT", async () => {
    const market = service(serve(() => ({ index: { bytes: new Uint8Array(), sig: new Uint8Array() } })));
    await expect(market.probe("::pas une url")).rejects.toThrow("INVALID_INPUT");
    await expect(market.addSource({ url: "http//m", publicKey: keys.publicKey })).rejects.toThrow(
      "INVALID_INPUT",
    );
  });

  test("a package hosted on another origin than its source is refused", async () => {
    const { pkg, bytes } = await makeTestPackage({ id: "burndown", version: "0.1.0" });
    const index = await signed("equipe", 1, [
      {
        id: "burndown",
        title: "Burndown",
        description: "",
        kind: "widget",
        versions: [
          {
            version: "0.1.0",
            hash: pkg.hash,
            publisherKey: pkg.publisher.publicKey,
            size: bytes.byteLength,
            permissions: grantedOf(pkg.manifest),
            publishedAt: pkg.publishedAt,
            url: "https://ailleurs.example/burndown.kpkg",
          },
        ],
      },
    ]);
    const get = serve(() => ({ index, files: new Map([["https://ailleurs.example/burndown.kpkg", bytes]]) }));
    const market = service(get);
    await market.addSource({ url: SOURCE, publicKey: keys.publicKey });
    await expect(market.getPackage({ sourceId: "equipe", id: "burndown", version: "0.1.0" })).rejects.toThrow(
      "INVALID_INPUT",
    );
    expect(get.mock.calls.map(([url]) => url)).not.toContain("https://ailleurs.example/burndown.kpkg");
  });
});

test("two simultaneous additions of the same source leave one and refuse the other", async () => {
  const index = await signed("equipe", 1);
  const market = service(serve(() => ({ index })));
  const results = await Promise.allSettled([
    market.addSource({ url: SOURCE, publicKey: keys.publicKey }),
    market.addSource({ url: SOURCE, publicKey: keys.publicKey }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const refused = results.find((r) => r.status === "rejected");
  expect(refused?.status === "rejected" && String(refused.reason)).toContain("INVALID_INPUT");
  expect(market.listSources()).toHaveLength(1);
});
