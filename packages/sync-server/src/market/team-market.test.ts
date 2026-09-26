import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeKpkg, generateKeyPair, owned } from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { readAudit } from "../audit";
import { MarketKit, KIT_NOW as NOW, outcome } from "./market-test-kit";
import { initMarketSource, MARKET_SOURCE_FILE, TeamMarket } from "./team-market";

let k: MarketKit;
let lea: string;
let tom: string;

beforeEach(async () => {
  k = await MarketKit.create("kibo-team-market-");
  lea = (await k.user("Léa")).userId;
  tom = (await k.user("Tom")).userId;
});
afterEach(() => k.close());

describe("source", () => {
  test("keeps its key in a 0600 file and refuses a second init", async () => {
    expect(statSync(join(k.dir, MARKET_SOURCE_FILE)).mode & 0o777).toBe(0o600);
    expect(await outcome(initMarketSource(k.dir, { id: "equipe", name: "Équipe" }))).toBe("INVALID_INPUT");
  });
  test("refuses an invalid source id", async () => {
    const other = mkdtempSync(join(tmpdir(), "kibo-team-market-id-"));
    expect(await outcome(initMarketSource(other, { id: "../x", name: "X" }))).toBe("INVALID_INPUT");
    rmSync(other, { recursive: true, force: true });
  });
  test("returns null when no source was initialised", async () => {
    const other = mkdtempSync(join(tmpdir(), "kibo-team-market-none-"));
    expect(await TeamMarket.open(k.sdb, other)).toBeNull();
    rmSync(other, { recursive: true, force: true });
  });
  test("a corrupt source file is STORE_CORRUPT", async () => {
    writeFileSync(join(k.dir, MARKET_SOURCE_FILE), "{", { mode: 0o600 });
    expect(await outcome(TeamMarket.open(k.sdb, k.dir))).toBe("STORE_CORRUPT");
  });
  test("starts with an empty signed index at serial 1", async () => {
    const index = await k.index();
    expect(index.serial).toBe(1);
    expect(index.packages).toEqual([]);
    expect(k.market.source()).toEqual({ id: "equipe", name: "Équipe", publicKey: k.sourceKey });
  });
  test("serves the index from memory for the current serial", async () => {
    const first = k.market.index();
    expect(first.serial).toBe(1);
    expect(k.market.index().bytes).toBe(first.bytes);
    k.market.grant(lea, "publisher");
    await k.publishAs(await makeTestPackage(), lea);
    expect(k.market.index().serial).toBe(2);
  });
});

describe("roles", () => {
  test("granting needs a known user and a known role", () => {
    expect(() => k.market.grant("nobody", "publisher")).toThrow("NOT_FOUND");
    expect(() => k.market.grant(lea, "admin" as "owner")).toThrow("INVALID_INPUT");
  });
});

describe("publish", () => {
  test("requires the publisher or owner role", async () => {
    expect(await outcome(k.publishAs(await makeTestPackage(), lea))).toBe("FORBIDDEN");
  });
  test("adds the version, bumps the serial and re-signs the index", async () => {
    k.market.grant(lea, "publisher");
    const published = await makeTestPackage({ publisherName: "Léa" });
    const { bytes, pkg } = published;
    expect(await k.publishAs(published, lea)).toEqual({ serial: 2 });
    const index = await k.index(1);
    expect(index.serial).toBe(2);
    expect(index.packages[0]?.versions[0]).toMatchObject({
      version: "0.3.0",
      hash: pkg.hash,
      publisherKey: pkg.publisher.publicKey,
      size: bytes.byteLength,
      url: "packages/burndown/0.3.0.kpkg",
    });
    expect(index.publishers).toEqual([{ publicKey: pkg.publisher.publicKey, name: "Léa", verified: true }]);
    expect(k.market.packageBytes("burndown", "0.3.0")).toEqual(owned(bytes));
    expect(readAudit(k.sdb, 5).map((e) => e.kind)).toContain("market-published");
  });
  test("lists versions in semver order under one entry per component", async () => {
    k.market.grant(lea, "publisher");
    const keys = await generateKeyPair();
    await k.publishAs(await makeTestPackage({ keys, version: "0.10.0" }), lea);
    await k.publishAs(await makeTestPackage({ keys, version: "0.9.0" }), lea);
    const index = await k.index();
    expect(index.packages).toHaveLength(1);
    expect(index.packages[0]?.versions.map((v) => v.version)).toEqual(["0.9.0", "0.10.0"]);
  });
  test("refuses the same version twice", async () => {
    k.market.grant(lea, "publisher");
    const first = await makeTestPackage();
    await k.publishAs(first, lea);
    const again = await makeTestPackage({ keys: first.keys, files: { "extra.ts": "export const x = 1;\n" } });
    expect(await outcome(k.publishAs(again, lea))).toBe("VERSION_EXISTS");
  });
  test("refuses a package whose signature does not match", async () => {
    k.market.grant(lea, "publisher");
    const made = await makeTestPackage();
    const forged = encodeKpkg({ ...made.pkg, publishedAt: "2030-01-01T00:00:00.000Z" });
    expect(await outcome(k.publishAs({ bytes: forged, keys: made.keys }, lea))).toBe("SIGNATURE_INVALID");
  });
  test("refuses a package whose content does not match its hash", async () => {
    k.market.grant(lea, "publisher");
    const made = await makeTestPackage();
    const files = made.pkg.files.map((f) => ({ ...f, sha256: "0".repeat(64) }));
    const tampered = encodeKpkg({ ...made.pkg, files });
    expect(await outcome(k.publishAs({ bytes: tampered, keys: made.keys }, lea))).toBe("HASH_MISMATCH");
  });
  test("refuses bytes that are not a package", async () => {
    k.market.grant(lea, "publisher");
    const html = { bytes: new TextEncoder().encode("<html>"), keys: await generateKeyPair() };
    expect(await outcome(k.publishAs(html, lea))).toBe("INVALID_INPUT");
  });
  test("concurrent publications get distinct increasing serials", async () => {
    k.market.grant(lea, "publisher");
    const keys = await generateKeyPair();
    const a = await makeTestPackage({ keys, version: "1.0.0" });
    const b = await makeTestPackage({ keys, version: "1.1.0" });
    const serials = await Promise.all([k.publishAs(a, lea), k.publishAs(b, lea)]);
    expect(serials.map((s) => s.serial).sort()).toEqual([2, 3]);
    expect((await k.index(3)).packages[0]?.versions).toHaveLength(2);
  });
  test("the serial survives a restart and keeps growing", async () => {
    k.market.grant(lea, "publisher");
    await k.publishAs(await makeTestPackage(), lea);
    await k.reopen();
    expect((await k.index(2)).serial).toBe(2);
    await k.publishAs(await makeTestPackage({ id: "velocity" }), lea);
    expect((await k.index(2)).serial).toBe(3);
  });
});

describe("revoke", () => {
  const revoke = (hash: string, reason: string, userId: string) =>
    k.market.revoke({ hash, reason }, { userId }, NOW);

  test("the publisher revokes its package and the index lists it", async () => {
    k.market.grant(lea, "publisher");
    const made = await makeTestPackage();
    await k.publishAs(made, lea);
    expect(await revoke(made.pkg.hash, "fuite de jeton", lea)).toEqual({ serial: 3 });
    expect((await k.index(2)).revoked).toEqual([{ hash: made.pkg.hash, reason: "fuite de jeton" }]);
    expect(readAudit(k.sdb, 5).map((e) => e.kind)).toContain("market-revoked");
  });
  test("another publisher cannot revoke, the source owner can", async () => {
    k.market.grant(lea, "publisher");
    k.market.grant(tom, "publisher");
    const made = await makeTestPackage();
    await k.publishAs(made, lea);
    expect(await outcome(revoke(made.pkg.hash, "x", tom))).toBe("FORBIDDEN");
    k.market.grant(tom, "owner");
    expect(await outcome(revoke(made.pkg.hash, "x", tom))).toBe("ok");
  });
  test("a publisher who lost its role cannot revoke", async () => {
    k.market.grant(lea, "publisher");
    const made = await makeTestPackage();
    await k.publishAs(made, lea);
    k.market.ungrant(lea);
    expect(await outcome(revoke(made.pkg.hash, "x", lea))).toBe("FORBIDDEN");
  });
  test("an unknown hash is NOT_FOUND and a malformed one INVALID_INPUT", async () => {
    k.market.grant(lea, "owner");
    expect(await outcome(revoke("a".repeat(64), "x", lea))).toBe("NOT_FOUND");
    expect(await outcome(revoke("zz", "x", lea))).toBe("INVALID_INPUT");
  });
  test("a reason with invisible or control characters is refused", async () => {
    k.market.grant(lea, "owner");
    for (const reason of ["faille​", "a\nb", "deux  espaces", "‮faille"]) {
      expect(await outcome(revoke("a".repeat(64), reason, lea))).toBe("INVALID_INPUT");
    }
  });
  test("a revoked package cannot be revoked nor published again", async () => {
    k.market.grant(lea, "publisher");
    const made = await makeTestPackage();
    await k.publishAs(made, lea);
    await revoke(made.pkg.hash, "faille", lea);
    expect(await outcome(revoke(made.pkg.hash, "x", lea))).toBe("INVALID_INPUT");
    expect(await outcome(k.publishAs(made, lea))).toBe("REVOKED");
  });
});
