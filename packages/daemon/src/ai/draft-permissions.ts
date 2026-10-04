import { ComponentManifest, GrantedPermissions, grantedOf, KiboError, NetRule } from "@kibo/schema";
import { readDraftManifest, writePermissions } from "./draft-files";

const unique = <T>(xs: T[]): T[] => [...new Set(xs)];
const isRule = (value: string) => NetRule.safeParse(value).success;

function netRuleOf(value: string): string {
  if (isRule(value)) return value;
  if (URL.canParse(value)) {
    const u = new URL(value);
    const withPath = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
    if (u.protocol === "https:" && u.port === "" && isRule(withPath)) return withPath;
    if (u.protocol === "https:" && u.port === "" && isRule(u.hostname)) return u.hostname;
  }
  throw new KiboError("VALIDATION_FAILED", `not a network rule: ${value}`);
}

export function grantedFromKeys(keys: string[]): GrantedPermissions {
  const reads: string[] = [];
  const writes: string[] = [];
  const net: string[] = [];
  const mcp: string[] = [];
  const capabilities: string[] = [];
  let data = false;
  for (const key of keys) {
    if (key === "data") data = true;
    else if (key.startsWith("read:")) reads.push(key.slice(5));
    else if (key.startsWith("write:")) writes.push(key.slice(6));
    else if (key.startsWith("net:")) net.push(netRuleOf(key.slice(4)));
    else if (key.startsWith("mcp:")) mcp.push(key.slice(4));
    else if (key.startsWith("cap:")) capabilities.push(key.slice(4));
    else throw new KiboError("VALIDATION_FAILED", `permission ${key} cannot be declared by Kibo`);
  }
  const parsed = GrantedPermissions.safeParse({
    reads: unique(reads),
    writes: unique(writes),
    data,
    net: unique(net),
    secrets: [],
    mcp: unique(mcp),
    capabilities: unique(capabilities),
  });
  if (!parsed.success || !ComponentManifest.shape.mcp.safeParse(parsed.data.mcp).success)
    throw new KiboError("VALIDATION_FAILED", `invalid permissions: ${keys.join(", ")}`);
  return parsed.data;
}

export function unionGranted(a: GrantedPermissions, b: GrantedPermissions): GrantedPermissions {
  return {
    reads: unique([...a.reads, ...b.reads]),
    writes: unique([...a.writes, ...b.writes]),
    data: a.data || b.data,
    net: unique([...a.net, ...b.net]),
    secrets: a.secrets,
    mcp: unique([...a.mcp, ...b.mcp]),
    capabilities: unique([...a.capabilities, ...b.capabilities]),
  };
}

function declarable(keys: string[]): GrantedPermissions | null {
  try {
    return grantedFromKeys(keys);
  } catch (e) {
    if (e instanceof KiboError && e.code === "VALIDATION_FAILED") return null;
    throw e;
  }
}

export function declareMissing(dir: string, missing: string[]): boolean {
  if (missing.length === 0) return false;
  const added = declarable(missing);
  if (!added) return false;
  writePermissions(dir, unionGranted(grantedOf(readDraftManifest(dir)), added));
  return true;
}
