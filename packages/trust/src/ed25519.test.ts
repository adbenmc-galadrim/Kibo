import { expect, spyOn, test } from "bun:test";
import { utf8 } from "./bytes";
import {
  formatFingerprint,
  generateKeyPair,
  keyFingerprint,
  shortHash,
  signBytes,
  verifyBytes,
} from "./ed25519";

test("a signature verifies with the matching public key", async () => {
  const keys = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("hello"));
  expect(await verifyBytes(keys.publicKey, utf8("hello"), sig)).toBe(true);
});

test("altered data, altered signature or another key fail", async () => {
  const keys = await generateKeyPair();
  const other = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("hello"));
  expect(await verifyBytes(keys.publicKey, utf8("hellO"), sig)).toBe(false);
  const flipped = `${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
  expect(await verifyBytes(keys.publicKey, utf8("hello"), flipped)).toBe(false);
  expect(await verifyBytes(other.publicKey, utf8("hello"), sig)).toBe(false);
});

test("malformed keys and signatures return false without throwing", async () => {
  const keys = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("x"));
  expect(await verifyBytes("not base64!", utf8("x"), sig)).toBe(false);
  expect(await verifyBytes("AAAA", utf8("x"), sig)).toBe(false);
  expect(await verifyBytes(keys.publicKey, utf8("x"), "AAAA")).toBe(false);
});

test("signing with a malformed private key is an input error", async () => {
  await expect(signBytes("AAAA", utf8("x"))).rejects.toThrow("INVALID_INPUT");
});

test("fingerprints are stable and formatted", async () => {
  const keys = await generateKeyPair();
  const fp = await keyFingerprint(keys.publicKey);
  expect(fp).toMatch(/^[0-9a-f]{64}$/);
  expect(await keyFingerprint(keys.publicKey)).toBe(fp);
  expect(formatFingerprint(fp).split(" ")).toHaveLength(16);
  expect(formatFingerprint("3f9a8b21")).toBe("3f9a 8b21");
  expect(shortHash("3f9a0000000000000000000000000000000000000000000000000000000c21e")).toBe("3f9a…c21e");
});

test("an unexpected WebCrypto failure is not turned into false", async () => {
  const keys = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("x"));
  const verify = spyOn(crypto.subtle, "verify").mockImplementation(() =>
    Promise.reject(new Error("engine down")),
  );
  try {
    await expect(verifyBytes(keys.publicKey, utf8("x"), sig)).rejects.toThrow("engine down");
  } finally {
    verify.mockRestore();
  }
});
