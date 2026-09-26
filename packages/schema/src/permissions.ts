import { z } from "zod";
import type { ComponentCall } from "./call";
import { COMMAND_WRITES } from "./command";
import { BuiltinEntityType, type ComponentManifest } from "./manifest";
import { NetRule, ruleCovers } from "./net";

export const GrantedPermissions = z.object({
  reads: z.array(BuiltinEntityType),
  writes: z.array(BuiltinEntityType),
  data: z.boolean(),
  net: z.array(NetRule),
});
export type GrantedPermissions = z.infer<typeof GrantedPermissions>;

export const NO_PERMISSIONS: GrantedPermissions = { reads: [], writes: [], data: false, net: [] };

const unique = <T>(xs: T[]): T[] => [...new Set(xs)];

export function grantedOf(
  m: Pick<ComponentManifest, "reads" | "writes" | "data" | "net">,
): GrantedPermissions {
  return { reads: unique(m.reads), writes: unique(m.writes), data: m.data, net: unique(m.net) };
}

export function permissionList(g: GrantedPermissions): string[] {
  return [
    ...g.reads.map((e) => `read:${e}`),
    ...g.writes.map((e) => `write:${e}`),
    ...(g.data ? ["data"] : []),
    ...g.net.map((r) => `net:${r}`),
  ];
}

export function permissionOfCall(call: ComponentCall): string | null {
  switch (call.kind) {
    case "list":
      return `read:${call.entity}`;
    case "run": {
      const entity = COMMAND_WRITES[call.command.method];
      return entity === null ? `write:${call.command.method}` : `write:${entity}`;
    }
    case "data.get":
    case "data.set":
    case "data.delete":
    case "data.keys":
      return "data";
    case "fetch":
      return `net:${call.url}`;
    case "action":
      return null;
    case "notes.read":
    case "notes.search":
    case "notes.info":
      return "read:note";
    case "notes.write":
    case "notes.rename":
    case "notes.remove":
      return "write:note";
  }
}

export function covers(declared: string[], used: string): boolean {
  if (!used.startsWith("net:")) return declared.includes(used);
  const url = used.slice(4);
  return declared.some((d) => d.startsWith("net:") && ruleCovers(d.slice(4), url));
}

export function diffPermissions(declared: string[], used: string[]): { missing: string[]; unused: string[] } {
  const u = unique(used);
  return {
    missing: u.filter((x) => !covers(declared, x)),
    unused: declared.filter((d) => !u.some((x) => covers([d], x))),
  };
}

export function addedPermissions(prev: GrantedPermissions | null, next: GrantedPermissions): string[] {
  const before = new Set(prev ? permissionList(prev) : []);
  return permissionList(next).filter((p) => !before.has(p));
}
