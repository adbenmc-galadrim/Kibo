import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import {
  NO_PERMISSIONS,
  SECRET_MARKET_PUBLISHER,
  SECRET_SYNC_DEVICE,
  type ValidationReport,
} from "@kibo/schema";
import {
  decodeKpkg,
  encodeKpkg,
  generateKeyPair,
  HTTP_SIGNATURE_HEADERS,
  httpSigningPayload,
  type KeyPair,
  kpkgSourceFiles,
  PUBLISHER_CLAIM_HEADER,
  sha256Hex,
  verifyBytes,
  verifyKpkgSignature,
  verifyPublisherClaim,
} from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createPublishLock } from "../components/publish-lock";
import { fakeBuild, okReport } from "../components/service.test-helper";
import { createComponentStore } from "../components/store";
import { createMemorySecretStore, type MemorySecretStore } from "../integrations/memory-secret-store";
import { createRedactor } from "../integrations/redact";
import { type FakeMarket, startFakeMarket } from "../testing/fake-market";
import { createMemoryRegistry } from "../testing/memory-registry";
import { startTeamProxy, type TeamProxy } from "../testing/team-proxy";
import { createHttpGet } from "./http-get";
import { writeSources } from "./install";
import { openMarketDb } from "./market-db";
import { MarketService } from "./market-service";
import { exportKpkg, type PublishDeps, publishToMarket } from "./publish";

let home: string;
let deps: PublishDeps;
let secrets: MemorySecretStore;
let fake: FakeMarket;
let market: MarketService;
let team: TeamProxy;
let device: KeyPair;
const SYNC = { serverUrl: "wss://127.0.0.1:1", caFile: null, userId: "u", deviceId: "d", displayName: "M" };
const INPUT = { id: "burndown", version: "0.1.0", sourceId: "equipe", publisherName: "Adam" };

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-publish-"));
  fake = await startFakeMarket();
  team = startTeamProxy(fake);
  device = await generateKeyPair();
  secrets = createMemorySecretStore(createRedactor());
  const store = createComponentStore({ home, toolchain: DEV_TOOLCHAIN, build: fakeBuild });
  const registry = createMemoryRegistry();
  const made = await makeTestPackage({ id: "burndown", version: "0.1.0", manifest: { title: "Burndown" } });
  const src = join(home, "src");
  await writeSources(src, await kpkgSourceFiles(made.pkg));
  const stored = await store.put(src);
  registry.port.put("burndown", "Burndown", {
    version: "0.1.0",
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
  market = new MarketService({
    db: openMarketDb(new Database(":memory:")),
    get: createHttpGet({ allowLoopbackHttp: true, log: () => {} }),
    registry: registry.port,
    now: () => 1,
    notify: mock(() => {}),
    log: mock(() => {}),
    emit: () => {},
  });
  deps = {
    store,
    registry: registry.port,
    market,
    secrets,
    syncConfig: () => null,
    caPem: async () => null,
    validate: okReport,
    lock: createPublishLock(),
    tmpRoot: join(home, "tmp"),
    now: () => Date.parse("2026-09-26T10:00:00Z"),
    log: () => {},
  };
});
afterEach(() => {
  team.stop();
  fake.stop();
  rmSync(home, { recursive: true, force: true });
});

describe("exportKpkg", () => {
  test("requires a publisher name the first time", async () => {
    await expect(exportKpkg(deps, { id: "burndown", version: "0.1.0" })).rejects.toThrow("INVALID_INPUT");
  });

  test("signs the stored sources and keeps the publisher key for later", async () => {
    const pkg = await exportKpkg(deps, { id: "burndown", version: "0.1.0", publisherName: "Adam" });
    await verifyKpkgSignature(pkg);
    expect(pkg.publisher.name).toBe("Adam");
    expect(pkg.publishedAt).toBe("2026-09-26T10:00:00.000Z");
    const again = await exportKpkg(deps, { id: "burndown", version: "0.1.0" });
    expect(again.publisher.publicKey).toBe(pkg.publisher.publicKey);
    expect(await secrets.has(SECRET_MARKET_PUBLISHER)).toBe(true);
  });

  test("keeps the first publisher name once the key exists", async () => {
    await exportKpkg(deps, { id: "burndown", version: "0.1.0", publisherName: "Adam" });
    const again = await exportKpkg(deps, { id: "burndown", version: "0.1.0", publisherName: "Autre" });
    expect(again.publisher.name).toBe("Adam");
  });

  test("refuses a component that is not the user's own", async () => {
    const v = deps.registry.get("burndown", "0.1.0");
    if (!v) throw new Error("fixture missing");
    deps.registry.put("burndown", "Burndown", { ...v, origin: "marketplace" });
    await expect(
      exportKpkg(deps, { id: "burndown", version: "0.1.0", publisherName: "Adam" }),
    ).rejects.toThrow("INVALID_INPUT");
  });

  test("a version revoked locally is neither exported nor published", async () => {
    const v = deps.registry.get("burndown", "0.1.0");
    if (!v) throw new Error("fixture missing");
    deps.registry.put("burndown", "Burndown", { ...v, revoked: { reason: "Faille", at: 1 } });
    await expect(
      exportKpkg(deps, { id: "burndown", version: "0.1.0", publisherName: "Adam" }),
    ).rejects.toThrow("REVOKED");
    await onTeam();
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("REVOKED");
    expect(team.received).toHaveLength(0);
    expect(await secrets.has(SECRET_MARKET_PUBLISHER)).toBe(false);
  });

  test("an unknown version is not found", async () => {
    await expect(
      exportKpkg(deps, { id: "burndown", version: "9.9.9", publisherName: "Adam" }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

const onTeam = async () => {
  await market.addSource({ url: team.sourceUrl, publicKey: fake.publicKey });
  await secrets.set(SECRET_SYNC_DEVICE, JSON.stringify(device));
  deps = { ...deps, syncConfig: () => ({ ...SYNC, serverUrl: team.serverUrl }) };
};

describe("publishToMarket", () => {
  test("needs a configured sync server", async () => {
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("SYNC_OFFLINE");
  });

  test("a static source is not a team source", async () => {
    await market.addSource({ url: fake.url, publicKey: fake.publicKey });
    deps = { ...deps, syncConfig: () => ({ ...SYNC, serverUrl: team.serverUrl }) };
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("INVALID_INPUT");
    expect(team.received).toHaveLength(0);
  });

  test("a failing generic validation stops the publication", async () => {
    const failing = async (dir: string): Promise<ValidationReport> => ({
      ...(await okReport(dir)),
      conformance: { ok: false, errors: ["render failed"] },
      ok: false,
    });
    await onTeam();
    deps = { ...deps, validate: failing };
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("VALIDATION_FAILED");
    expect(team.received).toHaveLength(0);
  });

  test("a publication of an id being published locally is refused", async () => {
    deps = { ...deps, syncConfig: () => SYNC };
    let release: () => void = () => {};
    const held = deps.lock.hold(
      "burndown",
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("CONFLICT");
    release();
    await held;
  });

  test("sends a device-signed package with the publisher claim", async () => {
    await onTeam();
    team.answer = (bytes) => {
      void fake.publish(bytes);
      return Response.json({ ok: true, result: { serial: 7 } });
    };
    expect(await publishToMarket(deps, INPUT)).toEqual({ serial: 7 });
    const [sent] = team.received;
    if (!sent) throw new Error("nothing sent");
    const pkg = decodeKpkg(sent.body);
    await verifyKpkgSignature(pkg);
    const h = HTTP_SIGNATURE_HEADERS;
    expect(sent.headers.get(h.device)).toBe("d");
    const payload = httpSigningPayload({
      method: "POST",
      path: "/v1/market/packages",
      date: sent.headers.get(h.date) ?? "",
      nonce: sent.headers.get(h.nonce) ?? "",
      bodySha256: await sha256Hex(sent.body),
    });
    expect(await verifyBytes(device.publicKey, payload, sent.headers.get(h.signature) ?? "")).toBe(true);
    const claim = sent.headers.get(PUBLISHER_CLAIM_HEADER) ?? "";
    expect(
      await verifyPublisherClaim({
        sourceId: "equipe",
        userId: "u",
        publicKey: pkg.publisher.publicKey,
        signature: claim,
      }),
    ).toBe(true);
  });

  test("a version already on the source is refused before sending", async () => {
    await onTeam();
    const pkg = await exportKpkg(deps, INPUT);
    await fake.publish(encodeKpkg(pkg));
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("VERSION_EXISTS");
    expect(team.received).toHaveLength(0);
  });

  test("a refusal of the server keeps its stable code", async () => {
    await onTeam();
    team.answer = () =>
      Response.json({ ok: false, error: { code: "FORBIDDEN", message: "role" } }, { status: 403 });
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("FORBIDDEN");
  });

  test("an unknown code or a malformed answer becomes INTERNAL", async () => {
    await onTeam();
    team.answer = () => Response.json({ ok: false, error: { code: "WHAT", message: "x" } }, { status: 500 });
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("INTERNAL");
    team.answer = () => new Response("<html>", { status: 502 });
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("INTERNAL");
  });

  test("an unreachable server is reported without its address", async () => {
    await onTeam();
    const unreachable = async () => {
      throw new TypeError("Unable to connect to 127.0.0.1:1");
    };
    deps = { ...deps, fetchImpl: Object.assign(unreachable, { preconnect: fetch.preconnect }) };
    const error = await publishToMarket(deps, INPUT).catch((e: unknown) => e);
    expect(String(error)).toContain("SYNC_OFFLINE");
    expect(String(error)).not.toContain("127.0.0.1");
  });

  test("without a device key the publication is unauthorized", async () => {
    await onTeam();
    await secrets.delete(SECRET_SYNC_DEVICE);
    await expect(publishToMarket(deps, INPUT)).rejects.toThrow("UNAUTHORIZED");
    expect(team.received).toHaveLength(0);
  });
});
