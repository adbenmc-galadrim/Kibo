import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import {
  createProjectDoc,
  createWorkspaceDoc,
  executeProjectCommand,
  getRegistryVersion,
  putRegistryVersion,
} from "@kibo/core";
import { ComponentManifest, NO_PERMISSIONS, type Page, type RegistryVersion } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createEventLog, ensureEventsTable } from "./events";
import { createFakeStore, type FakeStore, storedVersion } from "./fake-store.test-helper";
import { createRegistryService, type RegistryService } from "./registry-service";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const manifest = (version: string, extra: Record<string, unknown> = {}) =>
  ComponentManifest.parse({
    id: "pr-queue",
    version,
    kind: "widget",
    title: "PR en attente",
    reads: ["ticket"],
    writes: [],
    ...extra,
  });
const entry = (version: string, hash: string, patch: Partial<RegistryVersion> = {}): RegistryVersion => ({
  version,
  hash,
  origin: "ai",
  trust: null,
  approvedHash: null,
  granted: NO_PERMISSIONS,
  publishedAt: 1,
  autoUpdate: false,
  source: null,
  revoked: null,
  ...patch,
});

let ws: LoroDoc;
let project: LoroDoc;
let store: FakeStore;
let svc: RegistryService;
let stopped: string[];
let emitted: number;
let approvedHooks: string[];
let db: Database;

beforeEach(() => {
  ws = createWorkspaceDoc();
  project = createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  store = createFakeStore();
  stopped = [];
  emitted = 0;
  approvedHooks = [];
  db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  putRegistryVersion(ws, "pr-queue", "PR en attente", entry("0.3.0", H1));
  store.add(storedVersion(manifest("0.3.0", { net: ["api.github.com/graphql"] }), H1));
  svc = createRegistryService({
    workspace: ws,
    persistWorkspace: () => undefined,
    projects: () => [{ id: "p1", name: "Kibo", doc: project }],
    store,
    events: createEventLog(db, () => 7),
    stopBackend: (ref) => stopped.push(ref),
    emit: () => {
      emitted += 1;
    },
    onApproved: async (id, v) => {
      approvedHooks.push(`${id}@${v.version}`);
    },
  });
});

describe("approval", () => {
  test("approving grants the stored manifest's permissions and activates the version", async () => {
    expect(() => svc.active("pr-queue@0.3.0")).toThrow("TRUST_REQUIRED");
    const v = await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    expect(v).toMatchObject({
      trust: "sandboxed",
      approvedHash: H1,
      granted: { reads: ["ticket"], net: ["api.github.com/graphql"] },
    });
    expect(svc.active("pr-queue@0.3.0")).toEqual({
      ref: "pr-queue@0.3.0",
      trust: "sandboxed",
      granted: v.granted,
    });
    expect(svc.source("pr-queue@0.3.0")?.trust).toBe("sandboxed");
    expect(stopped).toEqual(["pr-queue@0.3.0"]);
    expect(emitted).toBe(1);
    expect(approvedHooks).toEqual([]);
  });
  test("a revoked version cannot be approved again", async () => {
    putRegistryVersion(
      ws,
      "pr-queue",
      "PR en attente",
      entry("0.3.0", H1, { origin: "marketplace", revoked: { reason: "clé compromise", at: 5 } }),
    );
    await expect(svc.approve("pr-queue", "0.3.0", H1, "sandboxed")).rejects.toThrow("REVOKED");
    expect(getRegistryVersion(ws, "pr-queue", "0.3.0")?.trust).toBeNull();
    expect(stopped).toEqual([]);
  });
  test("an old hash or a tampered store is a HASH_MISMATCH; built-ins cannot be approved", async () => {
    await expect(svc.approve("pr-queue", "0.3.0", H2, "trusted")).rejects.toThrow("HASH_MISMATCH");
    store.tamper("pr-queue", "0.3.0");
    await expect(svc.approve("pr-queue", "0.3.0", H1, "trusted")).rejects.toThrow("HASH_MISMATCH");
    await expect(svc.approve("kanban", "1.0.0", H1, "trusted")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.approve("pr-queue", "9.9.9", H1, "trusted")).rejects.toThrow("NOT_FOUND");
  });
  test("a deferred update-all runs once, after approval", async () => {
    putRegistryVersion(ws, "pr-queue", "PR en attente", entry("0.4.0", H2, { autoUpdate: true }));
    store.add(storedVersion(manifest("0.4.0"), H2));
    const v = await svc.approve("pr-queue", "0.4.0", H2, "sandboxed");
    expect(approvedHooks).toEqual(["pr-queue@0.4.0"]);
    expect(v.autoUpdate).toBe(false);
    expect(getRegistryVersion(ws, "pr-queue", "0.4.0")?.autoUpdate).toBe(false);
  });
  test("revoke stops the backend and deactivates", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "trusted");
    expect(svc.revoke("pr-queue", "0.3.0")).toMatchObject({ trust: null, approvedHash: null });
    expect(() => svc.active("pr-queue@0.3.0")).toThrow("TRUST_REQUIRED");
    expect(stopped).toEqual(["pr-queue@0.3.0", "pr-queue@0.3.0"]);
  });
});

describe("tampering", () => {
  test("verifyAll marks a tampered version, journals it and stops its backend", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    store.tamper("pr-queue", "0.3.0");
    expect(await svc.verifyAll()).toEqual(["pr-queue@0.3.0"]);
    expect(svc.isTampered("pr-queue@0.3.0")).toBe(true);
    expect(getRegistryVersion(ws, "pr-queue", "0.3.0")?.trust).toBeNull();
    expect(() => svc.active("pr-queue@0.3.0")).toThrow("TRUST_REQUIRED");
    expect(
      createEventLog(db)
        .list()
        .map((e) => [e.ref, e.kind, e.code]),
    ).toEqual([["pr-queue@0.3.0", "verify", "TRUST_REQUIRED"]]);
    expect(svc.list().find((c) => c.id === "pr-queue")?.versions[0]).toMatchObject({
      tampered: true,
      active: false,
    });
  });
  test("verify before a backend launch refuses a tampered version", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    store.tamper("pr-queue", "0.3.0");
    await expect(svc.verify("pr-queue@0.3.0")).rejects.toThrow("TRUST_REQUIRED");
    expect(svc.source("pr-queue@0.3.0")).toBeNull();
  });
  test("verify before a backend launch refuses an intact version that is not approved", async () => {
    await expect(svc.verify("pr-queue@0.3.0")).rejects.toThrow("TRUST_REQUIRED");
    await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    await svc.verify("pr-queue@0.3.0");
    svc.revoke("pr-queue", "0.3.0");
    await expect(svc.verify("pr-queue@0.3.0")).rejects.toThrow("TRUST_REQUIRED");
    expect(svc.isTampered("pr-queue@0.3.0")).toBe(false);
  });
  test("rehash keeps the flag while the files differ", async () => {
    await svc.approve("pr-queue", "0.3.0", H1, "sandboxed");
    store.tamper("pr-queue", "0.3.0");
    await svc.verifyAll();
    await expect(svc.rehash("pr-queue", "0.3.0")).rejects.toThrow("TRUST_REQUIRED");
    expect(svc.isTampered("pr-queue@0.3.0")).toBe(true);
  });
  test("rehash of an intact version confirms the hash", async () => {
    expect((await svc.rehash("pr-queue", "0.3.0")).hash).toBe(H1);
    expect(svc.isTampered("pr-queue@0.3.0")).toBe(false);
  });
});

describe("listing and uninstall", () => {
  test("usages come from every project, built-ins included", async () => {
    const page = executeProjectCommand(project, {
      method: "addPage",
      title: "Tableau de bord",
      kind: "dashboard",
    }) as Page;
    executeProjectCommand(project, { method: "addInstance", pageId: page.id, component: "pr-queue@0.3.0" });
    executeProjectCommand(project, { method: "addInstance", pageId: page.id, component: "kanban@1.0.0" });
    const list = svc.list();
    expect(list.map((c) => [c.id, c.builtin])).toEqual([
      ["kanban", true],
      ["tickets", true],
      ["graph", true],
      ["notes", true],
      ["mcp-source", true],
      ["viewer-3d", true],
      ["snake", true],
      ["pr-queue", false],
    ]);
    expect(list[0]?.versions).toEqual([
      expect.objectContaining({
        version: "1.0.0",
        trust: "builtin",
        origin: "kibo",
        active: true,
        usages: [expect.objectContaining({ pageTitle: "Tableau de bord", projectName: "Kibo" })],
      }),
    ]);
    expect(list.find((c) => c.id === "pr-queue")?.versions[0]).toMatchObject({
      version: "0.3.0",
      hash: H1,
      active: false,
      usages: [expect.objectContaining({ projectId: "p1" })],
    });
    await expect(svc.uninstall("pr-queue", "0.3.0")).rejects.toThrow("INVALID_INPUT");
  });
  test("an unused version is uninstalled from the registry and the store", async () => {
    await svc.uninstall("pr-queue", "0.3.0");
    expect(getRegistryVersion(ws, "pr-queue", "0.3.0")).toBeNull();
    expect(await store.verify("pr-queue", "0.3.0", H1)).toBe(false);
    expect(svc.list().map((c) => c.id)).toEqual([
      "kanban",
      "tickets",
      "graph",
      "notes",
      "mcp-source",
      "viewer-3d",
      "snake",
    ]);
  });
});

describe("input validation", () => {
  test("raw ids, versions and hashes are checked before reaching the store", async () => {
    await expect(svc.approve("../evil", "0.3.0", H1, "trusted")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.approve("pr-queue", "../0.3.0", H1, "trusted")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.approve("pr-queue", "0.3.0", "../x", "trusted")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.rehash("pr-queue", "x")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.uninstall("PR", "0.3.0")).rejects.toThrow("INVALID_INPUT");
    await expect(svc.verify("pr-queue@../0.3.0")).rejects.toThrow("INVALID_INPUT");
    expect(() => svc.revoke("pr-queue", "0.3")).toThrow("INVALID_INPUT");
    expect(() => svc.active("nope")).toThrow("INVALID_INPUT");
  });
});
