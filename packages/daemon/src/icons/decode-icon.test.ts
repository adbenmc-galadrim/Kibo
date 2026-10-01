import { expect, test } from "bun:test";
import { MAX_ICON_BYTES } from "@kibo/schema";
import { decodeIcon, sniffIconMime } from "./decode-icon";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0, 0]);
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

test("sniffs png, jpeg and webp by their signatures and nothing else", () => {
  expect(sniffIconMime(PNG)).toBe("image/png");
  expect(sniffIconMime(JPEG)).toBe("image/jpeg");
  expect(sniffIconMime(WEBP)).toBe("image/webp");
  expect(sniffIconMime(new Uint8Array(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")))).toBeNull();
  expect(sniffIconMime(new Uint8Array([0x89, 0x50]))).toBeNull();
});

test("decodes bytes that match the declared mime", () => {
  expect(decodeIcon({ mime: "image/png", data: b64(PNG) })).toEqual({ mime: "image/png", bytes: PNG });
});

test("refuses a mismatch, an oversized image and broken base64", () => {
  expect(() => decodeIcon({ mime: "image/png", data: b64(JPEG) })).toThrow("INVALID_INPUT");
  expect(() => decodeIcon({ mime: "image/png", data: b64(WEBP) })).toThrow("INVALID_INPUT");
  expect(() => decodeIcon({ mime: "image/png", data: b64(new Uint8Array(Buffer.from("<svg/>"))) })).toThrow(
    "INVALID_INPUT",
  );
  const big = new Uint8Array(MAX_ICON_BYTES + 1);
  big.set(PNG);
  expect(() => decodeIcon({ mime: "image/png", data: b64(big) })).toThrow("TOO_LARGE");
  expect(() => decodeIcon({ mime: "image/png", data: "iVBORw0KGgo" })).toThrow("INVALID_INPUT");
  expect(() => decodeIcon({ mime: "image/png", data: "iVBO=w0KGgo=" })).toThrow("INVALID_INPUT");
});
