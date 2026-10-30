import { describe, expect, test } from "bun:test";
import {
  addedPermissions,
  Base64,
  ComponentManifest,
  ConfigField,
  ConfigSchema,
  DEFAULT_WORKFLOW,
  diffPermissions,
  formatTicketKey,
  GrantedPermissions,
  grantedOf,
  isKiboErrorCode,
  KeyCombo,
  KiboError,
  NotesCall,
  Phase7Event,
  ProjectKey,
  permissionList,
  permissionOfCall,
  RpcRequest,
  Sha256,
  SYSTEM_AGENT_IDS,
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
  test("a feature key is F and a number", () => {
    expect(TicketKey.safeParse("F12").success).toBe(true);
    expect(TicketKey.safeParse("F1").success).toBe(true);
    for (const key of ["F", "f1", "SILO-F1", "F-1", "FF1"])
      expect(TicketKey.safeParse(key).success).toBe(false);
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

describe("permissions", () => {
  const base = { id: "probe", version: "1.0.0", kind: "widget", title: "P", reads: [], writes: [] };

  test("a version that gains a secret announces it (N41)", () => {
    const before = grantedOf(ComponentManifest.parse({ ...base, net: ["api.github.com"] }));
    const after = grantedOf(
      ComponentManifest.parse({
        ...base,
        net: ["api.github.com"],
        secrets: [{ name: "github", hosts: ["api.github.com"] }],
      }),
    );
    expect(addedPermissions(before, after)).toEqual(["secret:github@api.github.com"]);
  });

  test("notes.attach and notes.asset are calls with strict names", () => {
    const attach = { kind: "notes.attach", notePath: "a.md", mime: "image/png", bytes: "AA==" };
    expect(NotesCall.safeParse({ ...attach, name: "a-20261004-101500.png" }).success).toBe(true);
    expect(NotesCall.safeParse({ ...attach, name: "../x.png" }).success).toBe(false);
    expect(NotesCall.safeParse({ ...attach, name: "a/x.png" }).success).toBe(false);
    expect(NotesCall.safeParse({ ...attach, name: "X.png" }).success).toBe(false);
    expect(NotesCall.safeParse({ ...attach, name: "x.svg", mime: "image/svg+xml" }).success).toBe(false);
    expect(NotesCall.safeParse({ ...attach, name: "x.png", notePath: "../a.md" }).success).toBe(false);
    expect(NotesCall.safeParse({ ...attach, name: "x.png", bytes: "A".repeat(2_800_001) }).success).toBe(
      false,
    );
    expect(NotesCall.safeParse({ ...attach, name: "x.png", bytes: "<html>" }).success).toBe(false);
    expect(NotesCall.safeParse({ kind: "notes.asset", path: "assets/x.png" }).success).toBe(true);
    expect(NotesCall.safeParse({ kind: "notes.asset", path: "x.png" }).success).toBe(false);
    expect(NotesCall.safeParse({ kind: "notes.asset", path: "assets/../x.png" }).success).toBe(false);
    expect(NotesCall.safeParse({ kind: "notes.asset", path: "assets/a/x.png" }).success).toBe(false);
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
});

test("the agent error codes replace the profile one", () => {
  for (const code of ["AGENT_IN_USE", "READ_ONLY", "AGENT_NOT_FOUND"])
    expect(isKiboErrorCode(code)).toBe(true);
  expect(isKiboErrorCode("PROFILE_IN_USE")).toBe(false);
});

test("a failed backup has a stable code", () => {
  expect(isKiboErrorCode("BACKUP_FAILED")).toBe(true);
  expect(isKiboErrorCode("AGENT_EXECUTION_REMOVED")).toBe(false);
  expect(new KiboError("BACKUP_FAILED", "backup").code).toBe("BACKUP_FAILED");
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
});

test("phase 14 methods are part of RpcRequest", () => {
  expect(RpcRequest.safeParse({ method: "getAppInfo" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "createBackup", reason: "manual" }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "createBackup", reason: "auto" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "deleteBackup", id: "../x" }).success).toBe(false);
  expect(RpcRequest.safeParse({ method: "setBackupSettings", patch: { dir: null } }).success).toBe(true);
  expect(RpcRequest.safeParse({ method: "setBackupSettings", patch: { nope: 1 } }).success).toBe(false);
});

test("phase 14 events and the help combo", () => {
  expect(Phase7Event.safeParse({ type: "backups.changed" }).success).toBe(true);
  expect(KeyCombo.safeParse("mod+/").success).toBe(true);
  expect(SYSTEM_AGENT_IDS).toEqual(["project-agent"]);
});

test("capabilities are permissions", () => {
  const granted = grantedOf({
    reads: [],
    writes: [],
    data: false,
    net: [],
    secrets: [],
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
  expect(diffPermissions(["cap:assets"], ["cap:webgl"]).missing).toEqual(["cap:webgl"]);
  expect(addedPermissions(granted, { ...granted, capabilities: ["gamepad", "webgl", "audio"] })).toEqual([
    "cap:audio",
  ]);
});
