import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decodeKpkg,
  generateKeyPair,
  type KeyPair,
  owned,
  signRequest,
  verifyIndex,
  verifyMarketPackage,
} from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createInvite, redeemDeviceInvite } from "../accounts";
import { openServerDb, type ServerDb } from "../db";
import { createMarketLimits } from "./market-limits";
import { handleMarketRoute } from "./routes";
import { NONCE_TTL_MS, NonceCache } from "./signed-request";
import { initMarketSource, TeamMarket } from "./team-market";

let dir: string;
let sdb: ServerDb;
let server: ReturnType<typeof Bun.serve>;
let base: string;
let sourceKey: string;
let device: { deviceId: string; keys: KeyPair };

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-market-http-"));
  sdb = openServerDb(join(dir, "sync.db"));
  sourceKey = (await initMarketSource(dir, { id: "equipe", name: "Équipe" })).publicKey;
  const market = await TeamMarket.open(sdb, dir);
  if (!market) throw new Error("market source was not initialised");
  const invite = await createInvite(sdb, { kind: "account", name: "Léa", createdBy: "admin" }, Date.now());
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: "Mac" },
    Date.now(),
  );
  market.grant(joined.userId, "publisher");
  device = { deviceId: joined.deviceId, keys };
  const now = () => Date.now();
  const nonces = new NonceCache({ ttlMs: NONCE_TTL_MS, now });
  const limits = createMarketLimits(now);
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req, srv) {
      const ip = srv.requestIP(req)?.address ?? "unknown";
      const res = await handleMarketRoute(req, new URL(req.url), { sdb, market, nonces, now, limits, ip });
      return res ?? new Response("not found", { status: 404 });
    },
  });
  base = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.stop(true);
  sdb.close();
  rmSync(dir, { recursive: true, force: true });
});

test("a package published over HTTP verifies like a daemon source would", async () => {
  const { bytes } = await makeTestPackage({ publisherName: "Léa" });
  const auth = await signRequest({
    deviceId: device.deviceId,
    privateKey: device.keys.privateKey,
    method: "POST",
    path: "/v1/market/packages",
    body: bytes,
    now: Date.now(),
  });
  const published = await fetch(`${base}/v1/market/packages`, {
    method: "POST",
    headers: auth,
    body: owned(bytes),
  });
  expect(await published.json()).toEqual({ ok: true, result: { serial: 2 } });

  const sourceUrl = `${base}/market/`;
  const indexBytes = new Uint8Array(await (await fetch(new URL("index.json", sourceUrl))).arrayBuffer());
  const sig = (await (await fetch(new URL("index.json.sig", sourceUrl))).text()).trim();
  const index = await verifyIndex({ bytes: indexBytes, sig, expectedKey: sourceKey, lastSerial: 1 });
  const entry = index.packages[0]?.versions[0];
  if (!entry) throw new Error("index lists no version");
  const kpkg = new Uint8Array(await (await fetch(new URL(entry.url, sourceUrl))).arrayBuffer());
  const verified = await verifyMarketPackage({ pkg: decodeKpkg(kpkg), index, pinnedKey: null });
  expect(verified.publisher).toEqual({ name: "Léa", verified: true });
  expect(verified.newPublisher).toBe(true);
});
