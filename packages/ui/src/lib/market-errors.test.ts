import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { fingerprintHead, groupFingerprint, keyFingerprintHex, shortKeyPrint } from "./fingerprint";
import { marketErrorCode, marketErrorCodeText, marketErrorText, storedErrorText } from "./market-errors";

test("known codes get their French message", () => {
  expect(marketErrorText(new KiboError("SIGNATURE_INVALID", "bad"))).toBe("Signature invalide.");
  expect(marketErrorCodeText("INDEX_ROLLBACK")).toBe("Index refusé : numéro inférieur au dernier vu");
  expect(marketErrorText(new KiboError("FORBIDDEN", "remote"))).toBe(
    "Cette action n'est possible que depuis l'ordinateur où tourne Kibo.",
  );
});

test("unknown errors fall back to the generic message", () => {
  expect(marketErrorText(new Error("boom"))).toBe("Une erreur est survenue.");
  expect(marketErrorText(new KiboError("INTERNAL", "x"))).toBe("Une erreur est survenue.");
  expect(marketErrorCodeText("constructor")).toBe("Une erreur est survenue.");
});

test("a stored source error is read from its code prefix", () => {
  expect(storedErrorText("INDEX_ROLLBACK: serial 3 < 4")).toBe(
    "Index refusé : numéro inférieur au dernier vu",
  );
  expect(storedErrorText("fetch failed")).toBe("Une erreur est survenue.");
});

test("the error code is only read from a KiboError", () => {
  expect(marketErrorCode(new KiboError("REVOKED", "x"))).toBe("REVOKED");
  expect(marketErrorCode(new Error("REVOKED"))).toBeNull();
});

test("fingerprints are grouped by four", () => {
  const hex = "3f9a8b21".repeat(8);
  expect(groupFingerprint(hex).split(" ")).toHaveLength(16);
  expect(groupFingerprint(hex).startsWith("3f9a 8b21")).toBe(true);
  expect(fingerprintHead(hex)).toBe("3f9a 8b21 …");
});

test("the browser fingerprint matches a SHA-256 of the SPKI bytes", async () => {
  const key = "MCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const expected = new Bun.CryptoHasher("sha256").update(Buffer.from(key, "base64")).digest("hex");
  expect(await keyFingerprintHex(key)).toBe(expected);
});

test("a malformed key has no fingerprint", async () => {
  expect(await keyFingerprintHex("not base64!")).toBeNull();
});

test("a short key print keeps the head and the tail", () => {
  expect(shortKeyPrint(`${"7b2e".padEnd(60, "0")}c41a`)).toBe("ed25519:7b2e…c41a");
});
