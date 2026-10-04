import { describe, expect, test } from "bun:test";
import {
  addedPermissions,
  Base64,
  ComponentCall,
  ComponentManifest,
  ConfigField,
  ConfigSchema,
  covers,
  DEFAULT_WORKFLOW,
  diffPermissions,
  formatTicketKey,
  GrantedPermissions,
  grantedOf,
  isKiboErrorCode,
  KeyCombo,
  KiboError,
  NO_PERMISSIONS,
  Phase7Event,
  ProjectKey,
  permissionList,
  permissionOfCall,
  RpcRequest,
  Sha256,
  StartComponentDraftInput,
  SYSTEM_PROFILE_IDS,
  sniffImage,
  Ticket,
  TicketKey,
  validateConfig,
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
    pendingSeq: null,
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

  test("notes.attach and notes.asset are calls with strict names", () => {
    const attach = { kind: "notes.attach", notePath: "a.md", mime: "image/png", bytes: "AA==" };
    expect(ComponentCall.safeParse({ ...attach, name: "a-20261004-101500.png" }).success).toBe(true);
    expect(ComponentCall.safeParse({ ...attach, name: "../x.png" }).success).toBe(false);
    expect(ComponentCall.safeParse({ ...attach, name: "a/x.png" }).success).toBe(false);
    expect(ComponentCall.safeParse({ ...attach, name: "X.png" }).success).toBe(false);
    expect(ComponentCall.safeParse({ ...attach, name: "x.svg", mime: "image/svg+xml" }).success).toBe(false);
    expect(ComponentCall.safeParse({ ...attach, name: "x.png", notePath: "../a.md" }).success).toBe(false);
    expect(ComponentCall.safeParse({ ...attach, name: "x.png", bytes: "A".repeat(2_800_001) }).success).toBe(
      false,
    );
    expect(ComponentCall.safeParse({ ...attach, name: "x.png", bytes: "<html>" }).success).toBe(false);
    expect(ComponentCall.safeParse({ kind: "notes.asset", path: "assets/x.png" }).success).toBe(true);
    expect(ComponentCall.safeParse({ kind: "notes.asset", path: "x.png" }).success).toBe(false);
    expect(ComponentCall.safeParse({ kind: "notes.asset", path: "assets/../x.png" }).success).toBe(false);
    expect(ComponentCall.safeParse({ kind: "notes.asset", path: "assets/a/x.png" }).success).toBe(false);
    expect(permissionOfCall({ ...attach, kind: "notes.attach", mime: "image/png", name: "x.png" })).toBe(
      "write:note",
    );
    expect(permissionOfCall({ kind: "notes.asset", path: "assets/x.png" })).toBe("read:note");
  });

  test("sniffImage reads the type from the first bytes only", () => {
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
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

describe("phase 7 error codes", () => {
  test("new codes are accepted by KiboError", () => {
    const codes = [
      "UPDATE_REJECTED",
      "ACCESS_REVOKED",
      "INVITE_INVALID",
      "DEVICE_REVOKED",
      "TLS_REQUIRED",
      "SYNC_OFFLINE",
      "SIGNATURE_INVALID",
      "PUBLISHER_CHANGED",
      "REVOKED",
      "INDEX_ROLLBACK",
    ] as const;
    for (const code of codes) {
      expect(isKiboErrorCode(code)).toBe(true);
      const err = new KiboError(code, "detail");
      expect(err.code).toBe(code);
      expect(err.message).toBe(`${code}: detail`);
    }
  });
});

describe("shared encodings", () => {
  test("Base64 accepts padded standard base64 only", () => {
    expect(Base64.safeParse("a2libw==").success).toBe(true);
    expect(Base64.safeParse("").success).toBe(true);
    expect(Base64.safeParse("a2libw").success).toBe(false);
    expect(Base64.safeParse("a2l-bw==").success).toBe(false);
  });
  test("Sha256 is 64 lowercase hex characters", () => {
    expect(Sha256.safeParse("a".repeat(64)).success).toBe(true);
    expect(Sha256.safeParse("A".repeat(64)).success).toBe(false);
  });
});

test("capabilities are permissions", () => {
  const granted = grantedOf({
    reads: [],
    writes: [],
    data: false,
    net: [],
    secrets: [],
    mcp: [],
    capabilities: ["gamepad", "webgl"],
  });
  expect(granted.capabilities).toEqual(["gamepad", "webgl"]);
  expect(permissionList(granted)).toEqual(["cap:gamepad", "cap:webgl"]);
  expect(
    GrantedPermissions.parse({ reads: [], writes: [], data: false, net: [], secrets: [], mcp: [] })
      .capabilities,
  ).toEqual([]);
  expect(permissionOfCall({ kind: "assets.list" })).toBe("cap:assets");
  expect(permissionOfCall({ kind: "assets.url", name: "robot.glb" })).toBe("cap:assets");
  expect(covers(["cap:assets"], "cap:assets")).toBe(true);
  expect(diffPermissions(["cap:assets"], ["cap:webgl"]).missing).toEqual(["cap:webgl"]);
  expect(addedPermissions(granted, { ...granted, capabilities: ["gamepad", "webgl", "audio"] })).toEqual([
    "cap:audio",
  ]);
});

test("config fields may carry a label, help, bounds and an asset kind", () => {
  const schema = ConfigSchema.parse({
    model: { type: "string", nullable: true, default: null, asset: "model", label: "Modèle (.glb)" },
    speed: { type: "number", default: 1, min: 0.5, max: 4, help: "Vitesse de rotation" },
  });
  expect(validateConfig(schema, { model: "robot.glb", speed: 2 })).toEqual([]);
  expect(validateConfig(schema, { model: "../x.glb" })).toEqual(["model: not a project file name"]);
  expect(validateConfig(schema, { speed: 9 })).toEqual(["speed: above 4"]);
  expect(validateConfig(schema, { speed: 0 })).toEqual(["speed: below 0.5"]);
  expect(ConfigField.safeParse({ type: "string", label: "" }).success).toBe(false);
  expect(ConfigField.safeParse({ type: "number", asset: "model" }).success).toBe(false);
});

test("file rpc methods parse", () => {
  const ok = (req: unknown) => expect(RpcRequest.safeParse(req).success).toBe(true);
  ok({ method: "listAssets", projectId: "p" });
  ok({ method: "beginAssetUpload", projectId: "p", name: "robot.glb", mime: "model/gltf-binary", size: 12 });
  ok({
    method: "appendAssetUpload",
    uploadId: "9f0a2c3e-1111-4222-8333-444455556666",
    index: 0,
    bytes: "Z2xURg==",
  });
  ok({ method: "finishAssetUpload", uploadId: "9f0a2c3e-1111-4222-8333-444455556666" });
  ok({ method: "removeAsset", projectId: "p", name: "robot.glb" });
  ok({ method: "setFilesDir", projectId: "p", dir: null });
  ok({ method: "reportComponentRefusal", projectId: "p", instanceId: "i", kind: "focus" });
  expect(
    RpcRequest.safeParse({
      method: "beginAssetUpload",
      projectId: "p",
      name: "x.gltf",
      mime: "model/gltf-binary",
      size: 1,
    }).success,
  ).toBe(false);
  expect(
    RpcRequest.safeParse({
      method: "beginAssetUpload",
      projectId: "p",
      name: "x.glb",
      mime: "model/gltf-binary",
      size: 64 * 1024 * 1024 + 1,
    }).success,
  ).toBe(false);
  const created = StartComponentDraftInput.parse({
    mode: "create",
    id: "cube",
    title: "Cube",
    kind: "widget",
    withServer: false,
    description: "Un cube qui tourne lentement dans le widget.",
  });
  expect(created.mode === "create" ? created.template : null).toBe("blank");
});

test("phase 14 methods are part of RpcRequest", () => {
  expect(RpcRequest.safeParse({ method: "getAppInfo" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "createBackup", reason: "manual" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "createBackup", reason: "auto" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "deleteBackup", id: "../x" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "setBackupSettings", patch: { dir: null } }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "setBackupSettings", patch: { nope: 1 } }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "skipTutorialStep", step: "agent" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "markTutorialSeen", view: "kanban" }).success).toBe(false);
});

test("phase 14 events and the help combo", () => {
  expect(Phase7Event.safeParse({ type: "backups.changed" }).success).toBe(true);
  expect(Phase7Event.safeParse({ type: "tutorial.changed" }).success).toBe(true);
  expect(KeyCombo.safeParse("mod+/").success).toBe(true);
  expect(SYSTEM_PROFILE_IDS).toEqual(["assistant", "generateur", "demo"]);
});
