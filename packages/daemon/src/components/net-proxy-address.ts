import { isIP } from "node:net";

function v4Octets(ip: string): number[] {
  return ip.split(".").map(Number);
}

function isPublicV4(octets: readonly number[]): boolean {
  const [a = 0, b = 0, c = 0] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  return true;
}

function hexGroups(part: string): number[] {
  if (part === "") return [];
  return part.split(":").flatMap((group) => {
    if (!group.includes(".")) return [Number.parseInt(group, 16)];
    const [a = 0, b = 0, c = 0, d = 0] = v4Octets(group);
    return [(a << 8) | b, (c << 8) | d];
  });
}

function v6Groups(ip: string): number[] {
  const [head = "", tail] = ip.split("::");
  const left = hexGroups(head);
  if (tail === undefined) return left;
  const right = hexGroups(tail);
  return [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
}

function isPublicV6(groups: readonly number[]): boolean {
  const [g0 = 0, g1 = 0] = groups;
  if ((g0 & 0xe000) !== 0x2000) return false;
  if (g0 === 0x2001 && (g1 < 0x0200 || g1 === 0x0db8)) return false;
  if (g0 === 0x2002) return false;
  if (g0 === 0x3fff && g1 < 0x1000) return false;
  return true;
}

export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPublicV4(v4Octets(ip));
  if (version !== 6 || ip.includes("%")) return false;
  const groups = v6Groups(ip.toLowerCase());
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g))) return false;
  return isPublicV6(groups);
}
