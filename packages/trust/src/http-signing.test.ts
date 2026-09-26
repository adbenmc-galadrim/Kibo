import { expect, test } from "bun:test";
import { sha256Hex, utf8 } from "./bytes";
import { generateKeyPair, verifyBytes } from "./ed25519";
import { HTTP_SIGNATURE_HEADERS, httpSigningPayload, signRequest } from "./http-signing";

test("the signing payload is deterministic", () => {
  const input = {
    method: "POST",
    path: "/v1/market/packages",
    date: "1700000000000",
    nonce: "bm9uY2U=",
    bodySha256: "ab",
  };
  const text = new TextDecoder().decode(httpSigningPayload(input));
  expect(text).toBe("kibo-http-v1\nPOST\n/v1/market/packages\n1700000000000\nbm9uY2U=\nab");
  expect(httpSigningPayload(input)).toEqual(httpSigningPayload({ ...input }));
});

test("signRequest produces the four headers and a verifiable signature", async () => {
  const keys = await generateKeyPair();
  const body = utf8('{"x":1}');
  const headers = await signRequest({
    deviceId: "d1",
    privateKey: keys.privateKey,
    method: "POST",
    path: "/v1/market/revoke",
    body,
    now: 1700000000000,
  });
  expect(Object.keys(headers).sort()).toEqual(Object.values(HTTP_SIGNATURE_HEADERS).sort());
  expect(headers["x-kibo-device"]).toBe("d1");
  expect(headers["x-kibo-date"]).toBe("1700000000000");
  const payload = httpSigningPayload({
    method: "POST",
    path: "/v1/market/revoke",
    date: headers["x-kibo-date"] ?? "",
    nonce: headers["x-kibo-nonce"] ?? "",
    bodySha256: await sha256Hex(body),
  });
  expect(await verifyBytes(keys.publicKey, payload, headers["x-kibo-signature"] ?? "")).toBe(true);
});

test("two requests never share a nonce", async () => {
  const keys = await generateKeyPair();
  const input = {
    deviceId: "d1",
    privateKey: keys.privateKey,
    method: "POST",
    path: "/p",
    body: utf8(""),
    now: 1,
  };
  const a = await signRequest(input);
  const b = await signRequest(input);
  expect(a["x-kibo-nonce"]).not.toBe(b["x-kibo-nonce"]);
});
