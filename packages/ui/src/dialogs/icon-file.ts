import { ICON_MIMES, type IconInput, type IconMime, MAX_ICON_BYTES } from "@kibo/schema";

export type IconFileRefusal = "too-large" | "format";

export class IconFileError extends Error {
  constructor(readonly reason: IconFileRefusal) {
    super(reason);
    this.name = "IconFileError";
  }
}

const isIconMime = (type: string): type is IconMime => (ICON_MIMES as readonly string[]).includes(type);

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((byte, i) => bytes[offset + i] === byte);

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

export function sniffIconMime(bytes: Uint8Array): IconMime | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function readIconFile(file: File): Promise<IconInput> {
  if (!isIconMime(file.type)) throw new IconFileError("format");
  if (file.size > MAX_ICON_BYTES) throw new IconFileError("too-large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffIconMime(bytes);
  if (mime === null) throw new IconFileError("format");
  return { mime, data: bytesToBase64(bytes) };
}

export const iconDataUrl = (icon: IconInput): string => `data:${icon.mime};base64,${icon.data}`;
