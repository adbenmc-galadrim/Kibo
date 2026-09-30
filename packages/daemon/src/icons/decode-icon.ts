import { ICON_MIMES, type IconInput, type IconMime, KiboError, MAX_ICON_BYTES } from "@kibo/schema";

const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
const ascii = (bytes: Uint8Array, from: number, to: number): string =>
  String.fromCharCode(...bytes.subarray(from, to));

const SIGNATURES: Record<IconMime, (bytes: Uint8Array) => boolean> = {
  "image/png": (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  "image/webp": (b) => b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
};

export function sniffIconMime(bytes: Uint8Array): IconMime | null {
  return ICON_MIMES.find((mime) => SIGNATURES[mime](bytes)) ?? null;
}

function decodeBase64(data: string): Uint8Array {
  const buffer = Buffer.from(data, "base64");
  if (data.length % 4 !== 0 || buffer.toString("base64") !== data) {
    throw new KiboError("INVALID_INPUT", "icon data is not valid base64");
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export function decodeIcon(input: IconInput): { mime: IconMime; bytes: Uint8Array } {
  const bytes = decodeBase64(input.data);
  if (bytes.byteLength > MAX_ICON_BYTES) {
    throw new KiboError("TOO_LARGE", `icon is ${bytes.byteLength} bytes, at most ${MAX_ICON_BYTES}`);
  }
  if (sniffIconMime(bytes) !== input.mime) {
    throw new KiboError("INVALID_INPUT", `icon bytes are not ${input.mime}`);
  }
  return { mime: input.mime, bytes };
}
