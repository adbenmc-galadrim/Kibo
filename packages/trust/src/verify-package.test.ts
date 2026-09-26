import { describe, expect, test } from "bun:test";
import { KiboError, type Kpkg, type MarketIndex } from "@kibo/schema";
import { generateKeyPair, signBytes } from "./ed25519";
import { signingPayload } from "./kpkg";
import { makeTestIndex, makeTestPackage } from "./testing/fixtures";
import { verifyMarketPackage } from "./verify-package";

async function failure(p: Promise<unknown>): Promise<KiboError | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof KiboError) return e;
    throw e;
  }
}

const outcome = async (p: Promise<unknown>) => (await failure(p))?.code ?? "ok";

async function setup(opts: { revoke?: boolean } = {}) {
  const sourceKeys = await generateKeyPair();
  const made = await makeTestPackage();
  const { index } = await makeTestIndex({
    source: { id: "team", name: "Équipe", keys: sourceKeys },
    serial: 1,
    packages: [{ pkg: made.pkg }],
    revoked: opts.revoke ? [{ hash: made.pkg.hash, reason: "fuite de données" }] : [],
  });
  return { pkg: made.pkg, keys: made.keys, index };
}

describe("verifyMarketPackage", () => {
  test("first install pins a new publisher", async () => {
    const { pkg, index } = await setup();
    const res = await verifyMarketPackage({ pkg, index, pinnedKey: null });
    expect(res.newPublisher).toBe(true);
    expect(res.files.map((f) => f.path)).toContain("ui.tsx");
  });
  test("same pinned key is not a new publisher", async () => {
    const { pkg, index } = await setup();
    const res = await verifyMarketPackage({ pkg, index, pinnedKey: pkg.publisher.publicKey });
    expect(res.newPublisher).toBe(false);
  });
  test("another pinned key is PUBLISHER_CHANGED", async () => {
    const { pkg, index } = await setup();
    const other = await generateKeyPair();
    expect(await outcome(verifyMarketPackage({ pkg, index, pinnedKey: other.publicKey }))).toBe(
      "PUBLISHER_CHANGED",
    );
  });
  test("a revoked hash is REVOKED with its reason", async () => {
    const { pkg, index } = await setup({ revoke: true });
    const error = await failure(verifyMarketPackage({ pkg, index, pinnedKey: null }));
    expect(error?.code).toBe("REVOKED");
    expect(error?.detail).toContain("fuite de données");
  });
  test("a hash absent from the index is NOT_FOUND", async () => {
    const { pkg, index } = await setup();
    const empty: MarketIndex = { ...index, packages: [] };
    expect(await outcome(verifyMarketPackage({ pkg, index: empty, pinnedKey: null }))).toBe("NOT_FOUND");
  });
  test("a version listed with another hash is NOT_FOUND", async () => {
    const { index } = await setup();
    const other = await makeTestPackage({ title: "Autre" });
    expect(await outcome(verifyMarketPackage({ pkg: other.pkg, index, pinnedKey: null }))).toBe("NOT_FOUND");
  });
  test("a publisher other than the index entry is SIGNATURE_INVALID", async () => {
    const { pkg, index } = await setup();
    const other = await generateKeyPair();
    const rewritten: Kpkg = { ...pkg, publisher: { name: "Mallory", publicKey: other.publicKey } };
    const signature = await signBytes(other.privateKey, signingPayload(rewritten));
    expect(
      await outcome(verifyMarketPackage({ pkg: { ...rewritten, signature }, index, pinnedKey: null })),
    ).toBe("SIGNATURE_INVALID");
  });
  test("a badly signed and modified package fails on the signature first", async () => {
    const { pkg, index } = await setup();
    const files = pkg.files.map((f) => (f.path === "ui.tsx" ? { ...f, sha256: "1".repeat(64) } : f));
    const tampered = { ...pkg, files, signature: "AAAA" };
    expect(await outcome(verifyMarketPackage({ pkg: tampered, index, pinnedKey: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("returns the publisher name and verification from the index", async () => {
    const sourceKeys = await generateKeyPair();
    const { pkg } = await makeTestPackage({ publisherName: "Léa" });
    const { index } = await makeTestIndex({
      source: { id: "team", name: "Équipe", keys: sourceKeys },
      serial: 1,
      packages: [{ pkg, verified: false }],
    });
    const res = await verifyMarketPackage({ pkg, index, pinnedKey: null });
    expect(res.publisher).toEqual({ name: "Léa", verified: false });
  });
  test("a publisher name rewritten in transit is SIGNATURE_INVALID", async () => {
    const { pkg, index } = await setup();
    const tampered = { ...pkg, publisher: { ...pkg.publisher, name: "Kibo Officiel" } };
    expect(await outcome(verifyMarketPackage({ pkg: tampered, index, pinnedKey: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("a publisher missing from the index publishers is SIGNATURE_INVALID", async () => {
    const { pkg, index } = await setup();
    expect(
      await outcome(verifyMarketPackage({ pkg, index: { ...index, publishers: [] }, pinnedKey: null })),
    ).toBe("SIGNATURE_INVALID");
  });
  test("index permissions that differ from the manifest are INVALID_INPUT", async () => {
    const { pkg, index } = await setup();
    const packages = index.packages.map((p) => ({
      ...p,
      versions: p.versions.map((v) => ({
        ...v,
        permissions: { ...v.permissions, writes: ["ticket" as const] },
      })),
    }));
    expect(await outcome(verifyMarketPackage({ pkg, index: { ...index, packages }, pinnedKey: null }))).toBe(
      "INVALID_INPUT",
    );
  });
  test("a revoked and modified package is REVOKED before any hashing", async () => {
    const { pkg, index } = await setup({ revoke: true });
    const files = pkg.files.map((f) => ({ ...f, sha256: "1".repeat(64) }));
    expect(await outcome(verifyMarketPackage({ pkg: { ...pkg, files }, index, pinnedKey: null }))).toBe(
      "REVOKED",
    );
  });
  test("an unlisted and modified package is NOT_FOUND before any hashing", async () => {
    const { pkg, index } = await setup();
    const files = pkg.files.map((f) => ({ ...f, sha256: "1".repeat(64) }));
    const empty: MarketIndex = { ...index, packages: [] };
    expect(
      await outcome(verifyMarketPackage({ pkg: { ...pkg, files }, index: empty, pinnedKey: null })),
    ).toBe("NOT_FOUND");
  });
  test("a correctly signed but modified package is HASH_MISMATCH", async () => {
    const { pkg, index } = await setup();
    const files = pkg.files.map((f) => (f.path === "ui.tsx" ? { ...f, sha256: "1".repeat(64) } : f));
    expect(await outcome(verifyMarketPackage({ pkg: { ...pkg, files }, index, pinnedKey: null }))).toBe(
      "HASH_MISMATCH",
    );
  });
});
