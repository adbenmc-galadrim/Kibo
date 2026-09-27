import { z } from "zod";
import type { ComponentCall } from "./call";
import { COMMAND_WRITES } from "./command";
import { BuiltinEntityType, ComponentManifest } from "./manifest";
import { mcpCovered } from "./mcp-rules";
import { NetRule, ruleCovers } from "./net";

export const GrantedPermissions = z.object({
  reads: z.array(BuiltinEntityType),
  writes: z.array(BuiltinEntityType),
  data: z.boolean(),
  net: z.array(NetRule),
  secrets: ComponentManifest.shape.secrets,
  mcp: z.array(z.string()).default([]),
});
export type GrantedPermissions = z.infer<typeof GrantedPermissions>;

export const NO_PERMISSIONS: GrantedPermissions = {
  reads: [],
  writes: [],
  data: false,
  net: [],
  secrets: [],
  mcp: [],
};

const unique = <T>(xs: T[]): T[] => [...new Set(xs)];

export function grantedOf(
  m: Pick<ComponentManifest, "reads" | "writes" | "data" | "net" | "secrets" | "mcp">,
): GrantedPermissions {
  return {
    reads: unique(m.reads),
    writes: unique(m.writes),
    data: m.data,
    net: unique(m.net),
    secrets: m.secrets,
    mcp: unique(m.mcp),
  };
}

export function permissionList(g: GrantedPermissions): string[] {
  return [
    ...g.reads.map((e) => `read:${e}`),
    ...g.writes.map((e) => `write:${e}`),
    ...(g.data ? ["data"] : []),
    ...g.net.map((r) => `net:${r}`),
    ...g.secrets.flatMap((s) => s.hosts.map((host) => `secret:${s.name}@${host}`)),
    ...g.mcp.map((r) => `mcp:${r}`),
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
    case "mcp.call":
      return `mcp:${call.server}/${call.tool}`;
    case "mcp.read":
    case "mcp.import":
      return `mcp:${call.server}`;
    case "presence.list":
    case "sharing.get":
      return "read:ticket";
  }
}

function mcpUsed(used: string): { server: string; tool: string | null } {
  const rest = used.slice(4);
  const slash = rest.indexOf("/");
  return slash === -1
    ? { server: rest, tool: null }
    : { server: rest.slice(0, slash), tool: rest.slice(slash + 1) };
}

export function covers(
  declared: string[],
  used: string,
  config: Record<string, unknown> | null = null,
): boolean {
  if (used.startsWith("mcp:")) {
    const rules = declared.filter((d) => d.startsWith("mcp:")).map((d) => d.slice(4));
    const { server, tool } = mcpUsed(used);
    return mcpCovered(rules, server, tool, config);
  }
  if (!used.startsWith("net:")) return declared.includes(used);
  const url = used.slice(4);
  return declared.some((d) => d.startsWith("net:") && ruleCovers(d.slice(4), url));
}

export function diffPermissions(
  declared: string[],
  used: string[],
  config: Record<string, unknown> | null = null,
): { missing: string[]; unused: string[] } {
  const u = unique(used);
  return {
    missing: u.filter((x) => !covers(declared, x, config)),
    unused: declared.filter((d) => !u.some((x) => covers([d], x, config))),
  };
}

export function addedPermissions(prev: GrantedPermissions | null, next: GrantedPermissions): string[] {
  const before = new Set(prev ? permissionList(prev) : []);
  return permissionList(next).filter((p) => !before.has(p));
}
