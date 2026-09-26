import { beforeEach, describe, expect, test } from "bun:test";
import { challengePayload, KiboError } from "@kibo/schema";
import { generateKeyPair, signBytes } from "@kibo/trust";
import { createInvite, disableUser, redeemDeviceInvite, revokeDevice } from "./accounts";
import { CHALLENGE_TTL_MS, ChallengeNonces, newNonce, verifyChallenge } from "./auth";
import { openServerDb, type ServerDb } from "./db";

const ORIGIN = "wss://sync.kibo.test";
let sdb: ServerDb;
let device: { userId: string; deviceId: string; keys: Awaited<ReturnType<typeof generateKeyPair>> };

beforeEach(async () => {
  sdb = openServerDb(":memory:");
  const invite = await createInvite(sdb, { kind: "account", name: "Adam", createdBy: "admin" }, 1);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: "Mac" },
    1,
  );
  device = { userId: joined.userId, deviceId: joined.deviceId, keys };
});

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof KiboError ? e.code : "no-code"),
  );

const sign = (nonce: string, origin = ORIGIN) =>
  signBytes(device.keys.privateKey, challengePayload(nonce, origin));

describe("verifyChallenge", () => {
  test("nonces are 32 random bytes in base64", () => {
    const a = newNonce();
    expect(Buffer.from(a, "base64")).toHaveLength(32);
    expect(newNonce()).not.toBe(a);
  });
  test("accepts a signature of the nonce and the origin, and touches the device", async () => {
    const nonce = newNonce();
    const signature = await sign(nonce);
    const who = await verifyChallenge(
      sdb,
      { deviceId: device.deviceId, signature, nonce, origin: ORIGIN },
      99,
    );
    expect(who).toEqual({ userId: device.userId, deviceId: device.deviceId, name: "Adam" });
    const row = sdb.db.query("SELECT lastSeenAt FROM devices WHERE id = $id").get({ id: device.deviceId });
    expect(row).toEqual({ lastSeenAt: 99 });
  });
  test("a signature of another nonce (replay) is refused", async () => {
    const signature = await sign(newNonce());
    const input = { deviceId: device.deviceId, signature, nonce: newNonce(), origin: ORIGIN };
    expect(await outcome(verifyChallenge(sdb, input, 2))).toBe("UNAUTHORIZED");
  });
  test("a signature for another server origin is refused", async () => {
    const nonce = newNonce();
    const signature = await sign(nonce, "wss://evil.test");
    const input = { deviceId: device.deviceId, signature, nonce, origin: ORIGIN };
    expect(await outcome(verifyChallenge(sdb, input, 2))).toBe("UNAUTHORIZED");
  });
  test("an unknown device and a garbage signature are refused alike", async () => {
    const nonce = newNonce();
    const signature = await sign(nonce);
    const unknown = verifyChallenge(sdb, { deviceId: "nope", signature, nonce, origin: ORIGIN }, 2);
    const garbage = verifyChallenge(
      sdb,
      { deviceId: device.deviceId, signature: "!!", nonce, origin: ORIGIN },
      2,
    );
    const errors = await Promise.all([unknown, garbage].map((p) => p.catch((e: unknown) => e)));
    expect(errors.map((e) => (e instanceof KiboError ? e.message : "none"))).toEqual([
      "UNAUTHORIZED: authentication failed",
      "UNAUTHORIZED: authentication failed",
    ]);
  });
  test("a revoked device is DEVICE_REVOKED", async () => {
    revokeDevice(sdb, { deviceId: device.deviceId, by: "admin" }, 2);
    const nonce = newNonce();
    const signature = await sign(nonce);
    const input = { deviceId: device.deviceId, signature, nonce, origin: ORIGIN };
    expect(await outcome(verifyChallenge(sdb, input, 3))).toBe("DEVICE_REVOKED");
  });
  test("a disabled user is DEVICE_REVOKED", async () => {
    disableUser(sdb, device.userId, 2);
    const nonce = newNonce();
    const signature = await sign(nonce);
    const input = { deviceId: device.deviceId, signature, nonce, origin: ORIGIN };
    expect(await outcome(verifyChallenge(sdb, input, 3))).toBe("DEVICE_REVOKED");
  });
});

describe("ChallengeNonces", () => {
  test("a nonce is consumed once", () => {
    const nonces = new ChallengeNonces({ now: () => 0 });
    const nonce = nonces.issue();
    expect(nonces.consume(nonce)).toBe(true);
    expect(nonces.consume(nonce)).toBe(false);
    expect(nonces.consume(newNonce())).toBe(false);
  });
  test("a nonce expires after its lifetime", () => {
    let now = 0;
    const nonces = new ChallengeNonces({ now: () => now });
    const fresh = nonces.issue();
    const stale = nonces.issue();
    now = CHALLENGE_TTL_MS;
    expect(nonces.consume(fresh)).toBe(true);
    now = CHALLENGE_TTL_MS + 1;
    expect(nonces.consume(stale)).toBe(false);
  });
  test("expired nonces are forgotten", () => {
    let now = 0;
    const nonces = new ChallengeNonces({ now: () => now });
    for (let i = 0; i < 10; i++) nonces.issue();
    now = CHALLENGE_TTL_MS + 1;
    nonces.issue();
    expect(nonces.size).toBe(1);
  });
});
