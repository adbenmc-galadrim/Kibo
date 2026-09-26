import { expect, test } from "bun:test";

test("WebCrypto of this Bun exposes Ed25519", async () => {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const data = new TextEncoder().encode("kibo");
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, data);
  expect(await crypto.subtle.verify({ name: "Ed25519" }, pair.publicKey, sig, data)).toBe(true);
  expect((await crypto.subtle.exportKey("spki", pair.publicKey)).byteLength).toBe(44);
});
