import { describe, expect, test } from "bun:test";
import {
  addedPermissions,
  applyMigrations,
  COMMAND_WRITES,
  ComponentCall,
  ComponentManifest,
  compareSemver,
  configDefaults,
  diffPermissions,
  GrantedPermissions,
  grantedOf,
  isActive,
  isEmbeddedSpecifier,
  isSafeNotePath,
  NetRule,
  permissionList,
  permissionOfCall,
  RpcRequest,
  ruleCovers,
  SHARED_SPECIFIERS,
  shortHash,
  splitRef,
  validateConfig,
} from "./index";

const v0 = { id: "kanban", version: "1.0.0", kind: "both", title: "Kanban", reads: ["ticket"], writes: [] };

describe("manifest v1", () => {
  test("a v0 manifest is accepted with defaults", () => {
    const m = ComponentManifest.parse(v0);
    expect(m.data).toBe(false);
    expect(m.net).toEqual([]);
    expect(m.configVersion).toBe(0);
    expect(m.changes).toEqual([]);
    expect(m.sdk).toBe(1);
  });
  test("note and run are builtin entities", () => {
    expect(ComponentManifest.safeParse({ ...v0, reads: ["note", "run"] }).success).toBe(true);
  });
  test("net rules are https host + path prefix only", () => {
    for (const ok of ["api.github.com", "api.github.com/graphql", "a.b-c.io/x/y_z.~"]) {
      expect(NetRule.safeParse(ok).success).toBe(true);
    }
    for (const bad of [
      "10.0.0.1",
      "api.github.com:443",
      "*.github.com",
      "http://api.github.com",
      "localhost",
      "",
    ]) {
      expect(NetRule.safeParse(bad).success).toBe(false);
    }
  });
  test("configSchema uses field descriptors", () => {
    const m = ComponentManifest.parse({
      ...v0,
      configSchema: { filter: { enum: ["mine-and-agents", "all"], default: "mine-and-agents" } },
    });
    expect(configDefaults(m.configSchema)).toEqual({ filter: "mine-and-agents" });
    expect(validateConfig(m.configSchema, { filter: "all" })).toEqual([]);
    expect(validateConfig(m.configSchema, { filter: "mine" })).toHaveLength(1);
    expect(validateConfig(m.configSchema, { other: 1 })).toEqual(["other: unknown key"]);
    expect(validateConfig(undefined, {})).toEqual([]);
    expect(validateConfig({ path: { type: "string", nullable: true } }, { path: null })).toEqual([]);
    expect(validateConfig({ path: { type: "string" } }, { path: null })).toHaveLength(1);
  });
});

describe("net", () => {
  test("a rule covers https URLs on its host under its path prefix", () => {
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphql")).toBe(true);
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphql/x?y=1")).toBe(true);
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphqlx")).toBe(false);
    expect(ruleCovers("api.github.com/graphql", "https://api.github.com/graphql/../admin")).toBe(false);
    expect(ruleCovers("api.github.com", "http://api.github.com/")).toBe(false);
    expect(ruleCovers("api.github.com", "https://api.github.com:8443/")).toBe(false);
    expect(ruleCovers("api.github.com", "https://evil.com/?h=api.github.com")).toBe(false);
    expect(ruleCovers("api.github.com", "https://user@api.github.com/")).toBe(false);
    expect(ruleCovers("api.github.com", "not a url")).toBe(false);
  });
});

describe("permissions", () => {
  const m = ComponentManifest.parse({
    ...v0,
    writes: ["ticket"],
    data: true,
    net: ["api.github.com/graphql"],
  });
  test("a manifest lists its permissions", () => {
    expect(permissionList(grantedOf(m))).toEqual([
      "read:ticket",
      "write:ticket",
      "data",
      "net:api.github.com/graphql",
    ]);
  });
  test("each call maps to one permission", () => {
    expect(permissionOfCall({ kind: "list", entity: "status" })).toBe("read:status");
    expect(permissionOfCall({ kind: "list", entity: "run" })).toBe("read:run");
    expect(permissionOfCall({ kind: "run", command: { method: "deleteTicket", ticketId: "1@1" } })).toBe(
      "write:ticket",
    );
    expect(
      permissionOfCall({
        kind: "run",
        command: { method: "setInstanceData", instanceId: "i", key: "k", value: 1 },
      }),
    ).toBe("write:setInstanceData");
    expect(permissionOfCall({ kind: "data.keys" })).toBe("data");
    expect(permissionOfCall({ kind: "notes.search", query: "x" })).toBe("read:note");
    expect(permissionOfCall({ kind: "notes.remove", path: "a.md" })).toBe("write:note");
    expect(permissionOfCall({ kind: "notes.create", path: "a.md", markdown: "# A" })).toBe("write:note");
    expect(permissionOfCall({ kind: "action", name: "x", input: null })).toBeNull();
  });
  test("used net URLs are covered by declared rules", () => {
    const declared = permissionList(grantedOf(m));
    const d = diffPermissions(declared, ["read:ticket", "net:https://api.github.com/graphql", "write:link"]);
    expect(d.missing).toEqual(["write:link"]);
    expect(d.unused).toEqual(["write:ticket", "data"]);
  });
  test("added permissions compare two grants", () => {
    const before = grantedOf(ComponentManifest.parse(v0));
    expect(addedPermissions(before, grantedOf(m))).toEqual([
      "write:ticket",
      "data",
      "net:api.github.com/graphql",
    ]);
    expect(addedPermissions(null, before)).toEqual(["read:ticket"]);
  });
  test("a granted secret is a new permission, older grants read back without any", () => {
    const old = GrantedPermissions.parse({ reads: ["ticket"], writes: [], data: false, net: [] });
    expect(old.secrets).toEqual([]);
    const next = grantedOf({ ...m, secrets: [{ name: "github", hosts: ["api.github.com"] }] });
    expect(next.secrets).toEqual([{ name: "github", hosts: ["api.github.com"] }]);
    expect(addedPermissions(grantedOf(m), next)).toEqual(["secret:github@api.github.com"]);
    const wider = grantedOf({
      ...m,
      secrets: [{ name: "github", hosts: ["api.github.com", "uploads.github.com"] }],
    });
    expect(addedPermissions(next, wider)).toEqual(["secret:github@uploads.github.com"]);
  });
  test("reserved commands write nothing a component can declare", () => {
    expect(COMMAND_WRITES.setInstanceData).toBeNull();
    expect(COMMAND_WRITES.setInstanceComponent).toBeNull();
    expect(COMMAND_WRITES.addInstance).toBeNull();
    expect(COMMAND_WRITES.upsertExternalRef).toBeNull();
    expect(COMMAND_WRITES.removeExternalRef).toBeNull();
    expect(COMMAND_WRITES.importExternalTicket).toBeNull();
    expect(COMMAND_WRITES.addBinding).toBeNull();
    expect(COMMAND_WRITES.removeBinding).toBeNull();
  });
});

describe("calls", () => {
  test("component calls are validated", () => {
    expect(ComponentCall.safeParse({ kind: "data.set", key: "a.b-c_1", value: { x: 1 } }).success).toBe(true);
    expect(ComponentCall.safeParse({ kind: "data.get", key: "../x" }).success).toBe(false);
    expect(ComponentCall.safeParse({ kind: "notes.read", path: "../x.md" }).success).toBe(false);
    const f = ComponentCall.parse({ kind: "fetch", url: "https://api.github.com/x", init: {} });
    expect(f.kind === "fetch" && f.init.method).toBe("GET");
  });
  test("note paths stay relative, visible and markdown", () => {
    expect(isSafeNotePath("notes/decisions.md")).toBe(true);
    for (const bad of [
      "../x.md",
      "a/../../x.md",
      "/etc/x.md",
      ".obsidian/x.md",
      "a//b.md",
      "x.txt",
      "a\\b.md",
    ]) {
      expect(isSafeNotePath(bad)).toBe(false);
    }
  });
  test("the host reports a navigating frame, and only that refusal", () => {
    const report = { method: "reportComponentRefusal", projectId: "p", instanceId: "i", kind: "navigate" };
    expect(RpcRequest.safeParse(report).success).toBe(true);
    expect(RpcRequest.safeParse({ ...report, kind: "fetch" }).success).toBe(false);
    expect(RpcRequest.safeParse({ ...report, instanceId: "" }).success).toBe(false);
  });
});

describe("versions", () => {
  test("semver compares numerically", () => {
    expect(compareSemver("0.10.0", "0.9.9")).toBe(1);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
  });
  test("refs split on the last @", () => {
    expect(splitRef("acme.pr-bar@0.3.0")).toEqual({ id: "acme.pr-bar", version: "0.3.0" });
    expect(() => splitRef("nope")).toThrow("INVALID_INPUT");
  });
  test("a version is active when its approved hash is its hash", () => {
    const h = "a".repeat(64);
    expect(isActive({ trust: "sandboxed", hash: h, approvedHash: h })).toBe(true);
    expect(isActive({ trust: null, hash: h, approvedHash: h })).toBe(false);
    expect(isActive({ trust: "trusted", hash: h, approvedHash: "b".repeat(64) })).toBe(false);
    expect(shortHash(`3f9a${"0".repeat(56)}c21e`)).toBe("3f9a…c21e");
  });
  test("migrations run from n-1 to n and refuse a downgrade", () => {
    const m = {
      1: { config: (c: Record<string, unknown>) => ({ ...c, v: 1 }) },
      2: { data: (d: Record<string, unknown>) => ({ ...d, moved: true }) },
    };
    expect(applyMigrations(m, 0, 2, { config: {}, data: {} })).toEqual({
      config: { v: 1 },
      data: { moved: true },
    });
    expect(() => applyMigrations(m, 2, 1, { config: {}, data: {} })).toThrow("INVALID_INPUT");
  });
});

test("embedded specifiers cover three and the kits", () => {
  expect(isEmbeddedSpecifier("three")).toBe(true);
  expect(isEmbeddedSpecifier("three/addons/controls/OrbitControls.js")).toBe(true);
  expect(isEmbeddedSpecifier("@kibo/sdk/three")).toBe(true);
  expect(isEmbeddedSpecifier("@kibo/sdk/game")).toBe(true);
  expect(isEmbeddedSpecifier("threejs")).toBe(false);
  expect(isEmbeddedSpecifier("@kibo/sdk/mock")).toBe(false);
  expect(SHARED_SPECIFIERS).toContain("@kibo/sdk/ui/table");
  expect(SHARED_SPECIFIERS).toContain("@kibo/sdk/ui/switch");
});
