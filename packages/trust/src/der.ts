import { KiboError } from "@kibo/schema";
import { utf8 } from "./bytes";

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function encodeLength(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

export function tlv(tag: number, content: Uint8Array): Uint8Array {
  return concat(new Uint8Array([tag]), encodeLength(content.length), content);
}

export const sequence = (...items: Uint8Array[]): Uint8Array => tlv(0x30, concat(...items));
export const set = (...items: Uint8Array[]): Uint8Array => tlv(0x31, concat(...items));
export const utf8String = (text: string): Uint8Array => tlv(0x0c, utf8(text));
export const ia5 = (tag: number, text: string): Uint8Array => tlv(tag, utf8(text));
export const bitString = (bytes: Uint8Array): Uint8Array => tlv(0x03, concat(new Uint8Array([0]), bytes));
export const octetString = (bytes: Uint8Array): Uint8Array => tlv(0x04, bytes);
export const booleanTrue = (): Uint8Array => tlv(0x01, new Uint8Array([0xff]));
export const explicit = (n: number, content: Uint8Array): Uint8Array => tlv(0xa0 + n, content);

export function integer(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start++;
  const body = bytes.length ? bytes.slice(start) : new Uint8Array([0]);
  const first = body[0] ?? 0;
  return tlv(0x02, first & 0x80 ? concat(new Uint8Array([0]), body) : body);
}

function base128(n: number): number[] {
  const out = [n & 0x7f];
  for (let v = Math.floor(n / 128); v > 0; v = Math.floor(v / 128)) out.unshift((v & 0x7f) | 0x80);
  return out;
}

export function oid(dotted: string): Uint8Array {
  const [a = 0, b = 0, ...rest] = dotted.split(".").map(Number);
  return tlv(0x06, new Uint8Array([40 * a + b, ...rest].flatMap(base128)));
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function time(d: Date): Uint8Array {
  const body = `${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const year = d.getUTCFullYear();
  if (year >= 1950 && year < 2050) return tlv(0x17, utf8(`${pad(year % 100)}${body}`));
  return tlv(0x18, utf8(`${pad(year, 4)}${body}`));
}

function ipv4Bytes(ip: string): Uint8Array {
  const parts = ip.split(".").map(Number);
  if (parts.some((p) => p > 255)) throw new KiboError("INVALID_INPUT", `invalid IPv4 ${ip}`);
  return new Uint8Array(parts);
}

function ipv6Groups(ip: string): string[] {
  const halves = ip.split("::");
  const split = (part: string) => (part ? part.split(":") : []);
  if (halves.length === 1) return split(ip);
  if (halves.length > 2) throw new KiboError("INVALID_INPUT", `invalid IPv6 ${ip}`);
  const left = split(halves[0] ?? "");
  const right = split(halves[1] ?? "");
  const missing = 8 - left.length - right.length;
  if (missing < 1) throw new KiboError("INVALID_INPUT", `invalid IPv6 ${ip}`);
  return [...left, ...new Array<string>(missing).fill("0"), ...right];
}

export function ipBytes(ip: string): Uint8Array {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ipv4Bytes(ip);
  if (!/^[0-9a-fA-F:]+$/.test(ip) || !ip.includes(":"))
    throw new KiboError("INVALID_INPUT", `invalid IP ${ip}`);
  const groups = ipv6Groups(ip);
  if (groups.length !== 8 || groups.some((g) => g.length === 0 || g.length > 4)) {
    throw new KiboError("INVALID_INPUT", `invalid IPv6 ${ip}`);
  }
  return new Uint8Array(
    groups.flatMap((g) => {
      const v = Number.parseInt(g, 16);
      return [v >> 8, v & 0xff];
    }),
  );
}
