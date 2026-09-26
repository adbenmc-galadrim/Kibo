import { describe, expect, test } from "bun:test";
import {
  addedPermissions,
  ComponentCall,
  ComponentManifest,
  covers,
  DEFAULT_WORKFLOW,
  diffPermissions,
  formatTicketKey,
  GrantedPermissions,
  grantedOf,
  KiboError,
  NO_PERMISSIONS,
  ProjectKey,
  permissionList,
  permissionOfCall,
  Ticket,
  TicketKey,
} from "./index";

describe("keys", () => {
  test("ticket keys are flat and stable", () => {
    expect(formatTicketKey("KIB", 12)).toBe("KIB-12");
    expect(TicketKey.safeParse("KIB-12").success).toBe(true);
    expect(TicketKey.safeParse("KIB-12.1").success).toBe(false);
    expect(TicketKey.safeParse("kib-12").success).toBe(false);
  });
  test("project keys are 2 to 6 uppercase letters", () => {
    expect(ProjectKey.safeParse("KIB").success).toBe(true);
    expect(ProjectKey.safeParse("K").success).toBe(false);
    expect(ProjectKey.safeParse("KIBOKIB").success).toBe(false);
  });
});

describe("workflow", () => {
  test("default workflow has the six statuses in order", () => {
    expect(DEFAULT_WORKFLOW.map((s) => s.id)).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "blocked",
      "done",
    ]);
    expect(DEFAULT_WORKFLOW.find((s) => s.id === "blocked")?.label).toBe("Bloqué");
  });
});

describe("ticket", () => {
  const base = {
    id: "1@1",
    key: "KIB-1",
    title: "Setup",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
  };
  test("a blocked ticket needs a non-empty reason", () => {
    expect(Ticket.safeParse({ ...base, statusId: "blocked", blockedReason: null }).success).toBe(false);
    expect(Ticket.safeParse({ ...base, statusId: "blocked", blockedReason: "  " }).success).toBe(false);
    expect(Ticket.safeParse({ ...base, statusId: "blocked", blockedReason: "Attente client" }).success).toBe(
      true,
    );
  });
  test("a non-blocked ticket has no reason", () => {
    expect(Ticket.safeParse({ ...base, blockedReason: "x" }).success).toBe(false);
  });
});

describe("manifest", () => {
  test("version must be semver x.y.z", () => {
    const m = {
      id: "kanban",
      version: "1.0.0",
      kind: "both",
      title: "Kanban",
      reads: ["ticket", "status"],
      writes: ["ticket"],
    };
    expect(ComponentManifest.safeParse(m).success).toBe(true);
    expect(ComponentManifest.safeParse({ ...m, version: "v1.0" }).success).toBe(false);
  });
  test("keeps an optional description", () => {
    const m = {
      id: "kanban",
      version: "1.0.0",
      kind: "both",
      title: "Kanban",
      reads: [],
      writes: [],
    };
    expect(ComponentManifest.parse({ ...m, description: "Tickets par statut" }).description).toBe(
      "Tickets par statut",
    );
    expect(ComponentManifest.parse(m).description).toBeUndefined();
  });
});

test("KiboError carries a stable code", () => {
  const e = new KiboError("TREE_CYCLE", "cannot move under descendant");
  expect(e).toBeInstanceOf(Error);
  expect(e.code).toBe("TREE_CYCLE");
  expect(e.message).toBe("TREE_CYCLE: cannot move under descendant");
});

describe("mcp and ci_run permissions", () => {
  const base = { id: "probe", version: "1.0.0", kind: "widget", title: "P", reads: [], writes: [] };

  test("mcp calls map to a server or a tool permission", () => {
    expect(permissionOfCall({ kind: "mcp.call", server: "ctx", tool: "echo", args: {} })).toBe(
      "mcp:ctx/echo",
    );
    expect(permissionOfCall({ kind: "mcp.read", server: "ctx", uri: "x" })).toBe("mcp:ctx");
    const item = { itemId: "a1", title: "A", url: null };
    expect(permissionOfCall({ kind: "mcp.import", server: "ctx", item })).toBe("mcp:ctx");
    expect(permissionOfCall({ kind: "list", entity: "ci_run" })).toBe("read:ci_run");
  });

  test("mcp calls are validated", () => {
    expect(ComponentCall.safeParse({ kind: "mcp.call", server: "ctx", tool: "echo", args: {} }).success).toBe(
      true,
    );
    expect(ComponentCall.safeParse({ kind: "mcp.call", server: "CTX", tool: "echo", args: {} }).success).toBe(
      false,
    );
    expect(ComponentCall.safeParse({ kind: "mcp.call", server: "ctx", tool: "", args: {} }).success).toBe(
      false,
    );
    expect(ComponentCall.safeParse({ kind: "mcp.read", server: "../x", uri: "x" }).success).toBe(false);
    expect(ComponentCall.safeParse({ kind: "mcp.read", server: "ctx", uri: "" }).success).toBe(false);
    const item = { itemId: "a1", title: "A", url: "javascript:alert(1)" };
    expect(ComponentCall.safeParse({ kind: "mcp.import", server: "ctx", item }).success).toBe(false);
    expect(ComponentCall.safeParse({ kind: "list", entity: "ci_run" }).success).toBe(true);
  });

  test("covers resolves mcp rules, the config rule only with a config", () => {
    expect(covers(["mcp:ctx"], "mcp:ctx/echo")).toBe(true);
    expect(covers(["mcp:ctx"], "mcp:ctx")).toBe(true);
    expect(covers(["mcp:ctx/resolve"], "mcp:ctx/echo")).toBe(false);
    expect(covers(["mcp:ctx/echo"], "mcp:ctx")).toBe(false);
    expect(covers(["mcp:ctx"], "mcp:ctx2/echo")).toBe(false);
    expect(covers(["net:ctx", "read:ctx"], "mcp:ctx")).toBe(false);
    expect(covers(["mcp:{config.server}"], "mcp:fs/read")).toBe(false);
    expect(covers(["mcp:{config.server}"], "mcp:fs/read", { server: "fs" })).toBe(true);
    expect(covers(["mcp:{config.server}"], "mcp:ctx/read", { server: "fs" })).toBe(false);
    expect(covers(["mcp:ctx"], "net:https://ctx.com")).toBe(false);
    expect(covers(["mcp:ctx/a"], "mcp:ctx/a/b")).toBe(false);
    expect(
      covers(
        ["mcp:ctx/a"],
        permissionOfCall({ kind: "mcp.call", server: "ctx", tool: "a/b", args: {} }) ?? "",
      ),
    ).toBe(false);
  });

  test("diffPermissions passes the config to mcp rules", () => {
    const declared = ["mcp:{config.server}", "read:ci_run"];
    expect(diffPermissions(declared, ["mcp:fs/read"]).missing).toEqual(["mcp:fs/read"]);
    expect(diffPermissions(declared, ["mcp:fs/read"], { server: "fs" })).toEqual({
      missing: [],
      unused: ["read:ci_run"],
    });
  });

  test("granted mcp rules are listed, older grants read back without any", () => {
    const old = GrantedPermissions.parse({ reads: ["ticket"], writes: [], data: false, net: [] });
    expect(old.mcp).toEqual([]);
    expect(NO_PERMISSIONS.mcp).toEqual([]);
    const m = ComponentManifest.parse({ ...base, reads: ["ci_run"], mcp: ["ctx", "ctx", "fs/read"] });
    expect(grantedOf(m).mcp).toEqual(["ctx", "fs/read"]);
    expect(permissionList(grantedOf(m))).toEqual(["read:ci_run", "mcp:ctx", "mcp:fs/read"]);
  });

  test("a version that gains a secret and a server announces both (N41)", () => {
    const before = grantedOf(ComponentManifest.parse({ ...base, net: ["api.github.com"] }));
    const after = grantedOf(
      ComponentManifest.parse({
        ...base,
        net: ["api.github.com"],
        mcp: ["ctx"],
        secrets: [{ name: "github", hosts: ["api.github.com"] }],
      }),
    );
    expect(addedPermissions(before, after)).toEqual(["secret:github@api.github.com", "mcp:ctx"]);
    expect(addedPermissions(after, { ...after, mcp: ["ctx", "ctx/echo"] })).toEqual(["mcp:ctx/echo"]);
  });
});
