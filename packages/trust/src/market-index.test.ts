import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { utf8 } from "./bytes";
import { generateKeyPair, signBytes } from "./ed25519";
import { signIndex, verifyIndex } from "./market-index";
import { makeTestIndex, makeTestPackage } from "./testing/fixtures";

async function caught(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof KiboError) return e.code;
    throw e;
  }
}

async function fixture(serial = 3) {
  const keys = await generateKeyPair();
  const { pkg } = await makeTestPackage();
  const signed = await makeTestIndex({
    source: { id: "team", name: "Équipe", keys },
    serial,
    packages: [{ pkg }],
  });
  return { keys, ...signed };
}

describe("verifyIndex", () => {
  test("accepts an index signed by the expected key", async () => {
    const f = await fixture();
    const index = await verifyIndex({
      bytes: f.bytes,
      sig: f.sig,
      expectedKey: f.keys.publicKey,
      lastSerial: 2,
    });
    expect(index.serial).toBe(3);
    expect(index.packages[0]?.id).toBe("burndown");
  });
  test("accepts a first fetch without a known serial", async () => {
    const f = await fixture();
    const verify = verifyIndex({
      bytes: f.bytes,
      sig: f.sig,
      expectedKey: f.keys.publicKey,
      lastSerial: null,
    });
    expect(await caught(verify)).toBeNull();
  });
  test("accepts the same serial again", async () => {
    const f = await fixture();
    const verify = verifyIndex({ bytes: f.bytes, sig: f.sig, expectedKey: f.keys.publicKey, lastSerial: 3 });
    expect(await caught(verify)).toBeNull();
  });
  test("refuses a lower serial (rollback)", async () => {
    const f = await fixture(3);
    const verify = verifyIndex({ bytes: f.bytes, sig: f.sig, expectedKey: f.keys.publicKey, lastSerial: 4 });
    expect(await caught(verify)).toBe("INDEX_ROLLBACK");
  });
  test("refuses an index signed by another key", async () => {
    const f = await fixture();
    const other = await generateKeyPair();
    const resigned = await signIndex(f.index, other.privateKey);
    expect(await caught(verifyIndex({ ...resigned, expectedKey: f.keys.publicKey, lastSerial: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("refuses an index whose declared source key changed", async () => {
    const f = await fixture();
    const other = await generateKeyPair();
    const tampered = await signIndex(
      { ...f.index, source: { ...f.index.source, publicKey: other.publicKey } },
      f.keys.privateKey,
    );
    expect(await caught(verifyIndex({ ...tampered, expectedKey: f.keys.publicKey, lastSerial: null }))).toBe(
      "SIGNATURE_INVALID",
    );
  });
  test("refuses one extra whitespace byte", async () => {
    const f = await fixture();
    const bytes = new Uint8Array([...f.bytes, ...utf8(" ")]);
    expect(
      await caught(verifyIndex({ bytes, sig: f.sig, expectedKey: f.keys.publicKey, lastSerial: null })),
    ).toBe("SIGNATURE_INVALID");
  });
  test("refuses a garbage signature", async () => {
    const f = await fixture();
    const verify = verifyIndex({
      bytes: f.bytes,
      sig: "!!",
      expectedKey: f.keys.publicKey,
      lastSerial: null,
    });
    expect(await caught(verify)).toBe("SIGNATURE_INVALID");
  });
  test("refuses signed bytes that are not an index", async () => {
    const keys = await generateKeyPair();
    const bytes = utf8(JSON.stringify({ hello: "world" }));
    const sig = await signBytes(keys.privateKey, bytes);
    expect(await caught(verifyIndex({ bytes, sig, expectedKey: keys.publicKey, lastSerial: null }))).toBe(
      "INVALID_INPUT",
    );
  });
  test("refuses signed bytes that are not JSON", async () => {
    const keys = await generateKeyPair();
    const bytes = utf8("not json");
    const sig = await signBytes(keys.privateKey, bytes);
    expect(await caught(verifyIndex({ bytes, sig, expectedKey: keys.publicKey, lastSerial: null }))).toBe(
      "INVALID_INPUT",
    );
  });
});
