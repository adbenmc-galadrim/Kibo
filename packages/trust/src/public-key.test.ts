import { expect, test } from "bun:test";
import { fromBase64, toBase64, utf8 } from "./bytes";
import { generateKeyPair, keyFingerprint, parsePublicKey, signBytes, verifyBytes } from "./ed25519";

const SPKI_PREFIX = [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00];
const hex = (text: string): number[] => Array.from(text.match(/../g) ?? [], (b) => Number.parseInt(b, 16));
const spki = (point: number[]): string => toBase64(new Uint8Array([...SPKI_PREFIX, ...point]));
const withSign = (point: number[]): number[] => [...point.slice(0, 31), (point[31] ?? 0) | 0x80];

const IDENTITY = hex(`01${"00".repeat(31)}`);
const ORDER_2 = hex(`ec${"ff".repeat(30)}7f`);
const ORDER_4 = hex("00".repeat(32));
const ORDER_8_A = hex("c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a");
const ORDER_8_B = hex("26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05");
const SMALL_ORDER = [IDENTITY, ORDER_2, ORDER_4, ORDER_8_A, ORDER_8_B].flatMap((p) => [p, withSign(p)]);
const NON_CANONICAL = [hex(`ed${"ff".repeat(30)}7f`), hex(`ee${"ff".repeat(30)}7f`), hex("ff".repeat(32))];

const forged = (): string => {
  const sig = new Uint8Array(64);
  sig[0] = 1;
  return toBase64(sig);
};

test("a small-order public key never accepts a universal forged signature", async () => {
  const identity = spki(IDENTITY);
  expect(await verifyBytes(identity, utf8("kibo-http-v1\nPOST\n/v1/market/revoke\n..."), forged())).toBe(
    false,
  );
  expect(await verifyBytes(identity, utf8("anything else"), forged())).toBe(false);
});

test("small-order and non-canonical keys are refused as input errors", async () => {
  for (const point of [...SMALL_ORDER, ...NON_CANONICAL]) {
    expect(() => parsePublicKey(spki(point))).toThrow("INVALID_INPUT");
    expect(await verifyBytes(spki(point), utf8("m"), forged())).toBe(false);
    await expect(keyFingerprint(spki(point))).rejects.toThrow("INVALID_INPUT");
  }
});

test("a key with the wrong length or prefix is refused", async () => {
  const keys = await generateKeyPair();
  const raw = fromBase64(keys.publicKey);
  expect(() => parsePublicKey(toBase64(raw.slice(0, 43)))).toThrow("INVALID_INPUT");
  expect(() => parsePublicKey(toBase64(new Uint8Array([...raw, 0])))).toThrow("INVALID_INPUT");
  const otherOid = new Uint8Array(raw);
  otherOid[8] = 0x6e;
  expect(() => parsePublicKey(toBase64(otherOid))).toThrow("INVALID_INPUT");
  expect(() => parsePublicKey(keys.privateKey)).toThrow("INVALID_INPUT");
});

test("generated keys are accepted unchanged", async () => {
  for (let i = 0; i < 20; i++) {
    const keys = await generateKeyPair();
    expect(toBase64(parsePublicKey(keys.publicKey))).toBe(keys.publicKey);
    const sig = await signBytes(keys.privateKey, utf8("m"));
    expect(await verifyBytes(keys.publicKey, utf8("m"), sig)).toBe(true);
  }
});

test("a signature has a single base64 spelling", async () => {
  const keys = await generateKeyPair();
  const sig = await signBytes(keys.privateKey, utf8("m"));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const alt = `${sig.slice(0, 85)}${alphabet[alphabet.indexOf(sig[85] ?? "A") ^ 1]}==`;
  expect(alt).not.toBe(sig);
  expect(await verifyBytes(keys.publicKey, utf8("m"), alt)).toBe(false);
});
