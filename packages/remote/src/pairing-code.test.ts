import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { encodeBase64Url } from "./base64url";
import { generateRootKey } from "./crypto";
import { decodePairingCode, encodePairingCode } from "./pairing-code";

const pairToken = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
const code = { accountId: "acc-silo-1", pairToken, rootKey: generateRootKey() };

const refusal = (text: string): string | null => {
  try {
    decodePairingCode(text);
    return null;
  } catch (error) {
    return error instanceof KiboError ? error.code : "not a KiboError";
  }
};

describe("pairing code", () => {
  test("encode then decode round-trips", () => {
    const decoded = decodePairingCode(encodePairingCode(code));
    expect(decoded.accountId).toBe(code.accountId);
    expect(decoded.pairToken).toBe(code.pairToken);
    expect(decoded.rootKey).toEqual(code.rootKey);
  });

  test("decode tolerates surrounding whitespace of a pasted code", () => {
    expect(decodePairingCode(`  ${encodePairingCode(code)}\n`).accountId).toBe(code.accountId);
  });

  test('the encoded code has no "=" and no "/"', () => {
    for (let i = 0; i < 20; i++) {
      const text = encodePairingCode({ ...code, rootKey: generateRootKey() });
      expect(text.startsWith("kibo1.")).toBe(true);
      expect(text).not.toContain("=");
      expect(text).not.toContain("/");
    }
  });

  test("decode refuses a wrong prefix, a short payload, a bad base64url", () => {
    const valid = encodePairingCode(code);
    const payload = valid.slice("kibo1.".length);
    expect(refusal(`kibo2.${payload}`)).toBe("REMOTE_PAIRING_INVALID");
    expect(refusal(payload)).toBe("REMOTE_PAIRING_INVALID");
    expect(refusal(`kibo1.${payload.slice(0, -4)}`)).toBe("REMOTE_PAIRING_INVALID");
    expect(refusal(`kibo1.${payload}AAAA`)).toBe("REMOTE_PAIRING_INVALID");
    expect(refusal(`kibo1.${payload.slice(0, 10)}/${payload.slice(11)}`)).toBe("REMOTE_PAIRING_INVALID");
    expect(refusal("kibo1.")).toBe("REMOTE_PAIRING_INVALID");
  });

  test("encode refuses an invalid account, token or root key", () => {
    expect(() => encodePairingCode({ ...code, accountId: "" })).toThrow(KiboError);
    expect(() => encodePairingCode({ ...code, accountId: "a".repeat(256) })).toThrow(KiboError);
    expect(() => encodePairingCode({ ...code, pairToken: "short" })).toThrow(KiboError);
    expect(() => encodePairingCode({ ...code, rootKey: new Uint8Array(16) })).toThrow(KiboError);
  });
});
