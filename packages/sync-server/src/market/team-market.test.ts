import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { encodeKpkg, generateKeyPair, owned, toBase64, verifyIndex } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createInvite, redeemDeviceInvite } from "../accounts";
import { readAudit } from "../audit";
import { openServerDb, type ServerDb } from "../db";
import { initMarketSource, MARKET_SOURCE_FILE, TeamMarket } from "./team-market";

let dir: string;
let sdb: ServerDb;
let market: TeamMarket;
let sourceKey: string;
let lea: string;
let tom: string;
const NOW = 1_800_000_000_000;

const SMALL_ORDER_KEY = toBase64(
  new Uint8Array([
    0x30,
    0x2a,
    0x30,
    0x05,
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70,
    0x03,
    0x21,
    0x00,
    1,
    ...new Array(31).fill(0),
  ]),
);

async function user(name: string) {
  const invite = await createInvite(sdb, { kind: "account", name, createdBy: "admin" }, NOW);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: name },
    NOW,
  );
  return joined.userId;
}

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof KiboError ? e.code : "no-code"),
  );

async function openMarket(): Promise<TeamMarket> {
  const opened = await TeamMarket.open(sdb, dir);
  if (!opened) throw new Error("market source was not initialised");
  return opened;
}

const currentIndex = (lastSerial: number | null = null) =>
  verifyIndex({ ...market.index(), expectedKey: sourceKey, lastSerial });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "kibo-team-market-"));
  sdb = openServerDb(join(dir, "sync.db"));
  sourceKey = (await initMarketSource(dir, { id: "equipe", name: "Équipe" })).publicKey;
  market = await openMarket();
  lea = await user("Léa");
  tom = await user("Tom");
});
afterEach(() => {
  sdb.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("source", () => {
  test("keeps its key in a 0600 file and refuses a second init", async () => {
    expect(statSync(join(dir, MARKET_SOURCE_FILE)).mode & 0o777).toBe(0o600);
    expect(await outcome(initMarketSource(dir, { id: "equipe", name: "Équipe" }))).toBe("INVALID_INPUT");
  });
  test("refuses an invalid source id", async () => {
    const other = mkdtempSync(join(tmpdir(), "kibo-team-market-id-"));
    expect(await outcome(initMarketSource(other, { id: "../x", name: "X" }))).toBe("INVALID_INPUT");
    rmSync(other, { recursive: true, force: true });
  });
  test("returns null when no source was initialised", async () => {
    const other = mkdtempSync(join(tmpdir(), "kibo-team-market-none-"));
    expect(await TeamMarket.open(sdb, other)).toBeNull();
    rmSync(other, { recursive: true, force: true });
  });
  test("a corrupt source file is STORE_CORRUPT", async () => {
    writeFileSync(join(dir, MARKET_SOURCE_FILE), "{", { mode: 0o600 });
    expect(await outcome(TeamMarket.open(sdb, dir))).toBe("STORE_CORRUPT");
  });
  test("starts with an empty signed index at serial 1", async () => {
    const index = await currentIndex();
    expect(index.serial).toBe(1);
    expect(index.packages).toEqual([]);
    expect(market.source()).toEqual({ id: "equipe", name: "Équipe", publicKey: sourceKey });
  });
});

describe("roles", () => {
  test("granting needs a known user and a known role", () => {
    expect(() => market.grant("nobody", "publisher")).toThrow("NOT_FOUND");
    expect(() => market.grant(lea, "admin" as "owner")).toThrow("INVALID_INPUT");
  });
});

describe("publish", () => {
  test("requires the publisher or owner role", async () => {
    const { bytes } = await makeTestPackage();
    expect(await outcome(market.publish(bytes, { userId: lea }, NOW))).toBe("FORBIDDEN");
  });
  test("adds the version, bumps the serial and re-signs the index", async () => {
    market.grant(lea, "publisher");
    const { bytes, pkg } = await makeTestPackage({ publisherName: "Léa" });
    expect(await market.publish(bytes, { userId: lea }, NOW)).toEqual({ serial: 2 });
    const index = await currentIndex(1);
    expect(index.serial).toBe(2);
    expect(index.packages[0]?.versions[0]).toMatchObject({
      version: "0.3.0",
      hash: pkg.hash,
      publisherKey: pkg.publisher.publicKey,
      size: bytes.byteLength,
      url: "packages/burndown/0.3.0.kpkg",
    });
    expect(index.publishers).toEqual([{ publicKey: pkg.publisher.publicKey, name: "Léa", verified: true }]);
    expect(market.packageBytes("burndown", "0.3.0")).toEqual(owned(bytes));
    expect(readAudit(sdb, 5).map((e) => e.kind)).toContain("market-published");
  });
  test("lists versions in semver order under one entry per component", async () => {
    market.grant(lea, "publisher");
    const keys = await generateKeyPair();
    await market.publish((await makeTestPackage({ keys, version: "0.10.0" })).bytes, { userId: lea }, NOW);
    await market.publish((await makeTestPackage({ keys, version: "0.9.0" })).bytes, { userId: lea }, NOW);
    const index = await currentIndex();
    expect(index.packages).toHaveLength(1);
    expect(index.packages[0]?.versions.map((v) => v.version)).toEqual(["0.9.0", "0.10.0"]);
  });
  test("refuses the same version twice", async () => {
    market.grant(lea, "publisher");
    const first = await makeTestPackage();
    await market.publish(first.bytes, { userId: lea }, NOW);
    const again = await makeTestPackage({ keys: first.keys, files: { "extra.ts": "export const x = 1;\n" } });
    expect(await outcome(market.publish(again.bytes, { userId: lea }, NOW))).toBe("VERSION_EXISTS");
  });
  test("refuses another publisher key for the same component", async () => {
    market.grant(lea, "publisher");
    market.grant(tom, "publisher");
    await market.publish((await makeTestPackage()).bytes, { userId: lea }, NOW);
    const other = await makeTestPackage({ version: "0.4.0", publisherName: "Tom" });
    expect(await outcome(market.publish(other.bytes, { userId: tom }, NOW))).toBe("PUBLISHER_CHANGED");
  });
  test("refuses a publisher key registered by another user", async () => {
    market.grant(lea, "publisher");
    market.grant(tom, "publisher");
    const keys = await generateKeyPair();
    await market.publish((await makeTestPackage({ keys })).bytes, { userId: lea }, NOW);
    const stolen = await makeTestPackage({ id: "velocity", keys });
    expect(await outcome(market.publish(stolen.bytes, { userId: tom }, NOW))).toBe("FORBIDDEN");
  });
  test("freezes the publisher name at the first publication", async () => {
    market.grant(lea, "publisher");
    const keys = await generateKeyPair();
    await market.publish((await makeTestPackage({ keys, publisherName: "Léa" })).bytes, { userId: lea }, NOW);
    const renamed = await makeTestPackage({ keys, version: "0.4.0", publisherName: "Admin" });
    expect(await outcome(market.publish(renamed.bytes, { userId: lea }, NOW))).toBe("INVALID_INPUT");
    expect((await currentIndex()).publishers.map((p) => p.name)).toEqual(["Léa"]);
  });
  test("refuses a publisher name already used by another user", async () => {
    market.grant(lea, "publisher");
    market.grant(tom, "publisher");
    await market.publish((await makeTestPackage({ publisherName: "Léa" })).bytes, { userId: lea }, NOW);
    const impostor = await makeTestPackage({ id: "velocity", publisherName: " léa " });
    expect(await outcome(market.publish(impostor.bytes, { userId: tom }, NOW))).toBe("INVALID_INPUT");
  });
  test("refuses a weak publisher key", async () => {
    market.grant(lea, "publisher");
    const { pkg } = await makeTestPackage();
    const weak = encodeKpkg({ ...pkg, publisher: { ...pkg.publisher, publicKey: SMALL_ORDER_KEY } });
    expect(await outcome(market.publish(weak, { userId: lea }, NOW))).toBe("INVALID_INPUT");
  });
  test("refuses a package whose signature does not match", async () => {
    market.grant(lea, "publisher");
    const { pkg } = await makeTestPackage();
    const forged = encodeKpkg({ ...pkg, publishedAt: "2030-01-01T00:00:00.000Z" });
    expect(await outcome(market.publish(forged, { userId: lea }, NOW))).toBe("SIGNATURE_INVALID");
  });
  test("refuses a package whose content does not match its hash", async () => {
    market.grant(lea, "publisher");
    const { pkg } = await makeTestPackage();
    const tampered = encodeKpkg({ ...pkg, files: pkg.files.map((f) => ({ ...f, sha256: "0".repeat(64) })) });
    expect(await outcome(market.publish(tampered, { userId: lea }, NOW))).toBe("HASH_MISMATCH");
  });
  test("refuses bytes that are not a package", async () => {
    market.grant(lea, "publisher");
    expect(await outcome(market.publish(new TextEncoder().encode("<html>"), { userId: lea }, NOW))).toBe(
      "INVALID_INPUT",
    );
  });
  test("concurrent publications get distinct increasing serials", async () => {
    market.grant(lea, "publisher");
    const keys = await generateKeyPair();
    const a = await makeTestPackage({ keys, version: "1.0.0" });
    const b = await makeTestPackage({ keys, version: "1.1.0" });
    const serials = await Promise.all([
      market.publish(a.bytes, { userId: lea }, NOW),
      market.publish(b.bytes, { userId: lea }, NOW),
    ]);
    expect(serials.map((s) => s.serial).sort()).toEqual([2, 3]);
    expect((await currentIndex(3)).packages[0]?.versions).toHaveLength(2);
  });
  test("the serial survives a restart and keeps growing", async () => {
    market.grant(lea, "publisher");
    await market.publish((await makeTestPackage()).bytes, { userId: lea }, NOW);
    market = await openMarket();
    expect((await currentIndex(2)).serial).toBe(2);
    await market.publish((await makeTestPackage({ id: "velocity" })).bytes, { userId: lea }, NOW);
    expect((await currentIndex(2)).serial).toBe(3);
  });
});

describe("revoke", () => {
  test("the publisher revokes its package and the index lists it", async () => {
    market.grant(lea, "publisher");
    const { bytes, pkg } = await makeTestPackage();
    await market.publish(bytes, { userId: lea }, NOW);
    expect(await market.revoke({ hash: pkg.hash, reason: "fuite de jeton" }, { userId: lea }, NOW)).toEqual({
      serial: 3,
    });
    const index = await currentIndex(2);
    expect(index.revoked).toEqual([{ hash: pkg.hash, reason: "fuite de jeton" }]);
    expect(readAudit(sdb, 5).map((e) => e.kind)).toContain("market-revoked");
  });
  test("another publisher cannot revoke, the source owner can", async () => {
    market.grant(lea, "publisher");
    market.grant(tom, "publisher");
    const { bytes, pkg } = await makeTestPackage();
    await market.publish(bytes, { userId: lea }, NOW);
    expect(await outcome(market.revoke({ hash: pkg.hash, reason: "x" }, { userId: tom }, NOW))).toBe(
      "FORBIDDEN",
    );
    market.grant(tom, "owner");
    expect(await outcome(market.revoke({ hash: pkg.hash, reason: "x" }, { userId: tom }, NOW))).toBe("ok");
  });
  test("a publisher who lost its role cannot revoke", async () => {
    market.grant(lea, "publisher");
    const { bytes, pkg } = await makeTestPackage();
    await market.publish(bytes, { userId: lea }, NOW);
    market.ungrant(lea);
    expect(await outcome(market.revoke({ hash: pkg.hash, reason: "x" }, { userId: lea }, NOW))).toBe(
      "FORBIDDEN",
    );
  });
  test("an unknown hash is NOT_FOUND and a malformed one INVALID_INPUT", async () => {
    market.grant(lea, "owner");
    expect(await outcome(market.revoke({ hash: "a".repeat(64), reason: "x" }, { userId: lea }, NOW))).toBe(
      "NOT_FOUND",
    );
    expect(await outcome(market.revoke({ hash: "zz", reason: "x" }, { userId: lea }, NOW))).toBe(
      "INVALID_INPUT",
    );
  });
  test("a revoked package cannot be revoked nor published again", async () => {
    market.grant(lea, "publisher");
    const { bytes, pkg } = await makeTestPackage();
    await market.publish(bytes, { userId: lea }, NOW);
    await market.revoke({ hash: pkg.hash, reason: "faille" }, { userId: lea }, NOW);
    expect(await outcome(market.revoke({ hash: pkg.hash, reason: "x" }, { userId: lea }, NOW))).toBe(
      "INVALID_INPUT",
    );
    expect(await outcome(market.publish(bytes, { userId: lea }, NOW))).toBe("REVOKED");
  });
});
