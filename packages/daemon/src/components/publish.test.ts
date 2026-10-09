import { Database } from "bun:sqlite";
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addInstance,
  addPage,
  createProjectDoc,
  createWorkspaceDoc,
  executeProjectCommand,
  getRegistryVersion,
} from "@kibo/core";
import { hashSources } from "@kibo/devkit";
import { KiboError, type ValidationReport } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { draftsDir } from "./drafts";
import { createEventLog, ensureEventsTable } from "./events";
import { createFakeStore } from "./fake-store.test-helper";
import { createPublisher } from "./publish";
import { createRegistryService, type RegistryService } from "./registry-service";

const homes: string[] = [];
afterAll(() => {
  for (const h of homes) rmSync(h, { recursive: true, force: true });
});

let home: string;
let ws: LoroDoc;
let project: LoroDoc;
let registry: RegistryService;
let updates: string[];
let failFor: string | null;
let validationOk: boolean;
let sourcesRefused: boolean;
let publisher: ReturnType<typeof createPublisher>;

function writeDraft(
  version: string,
  extra: Record<string, unknown> = {},
  ui = "export function Component() { return null; }",
) {
  const dir = join(draftsDir(home), "pr-queue");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "kibo.component.json"),
    JSON.stringify({
      id: "pr-queue",
      version,
      kind: "widget",
      title: "PR en attente",
      reads: ["ticket"],
      writes: [],
      ...extra,
    }),
  );
  writeFileSync(join(dir, "ui.tsx"), ui);
  return dir;
}

const report = async (dir: string): Promise<ValidationReport> => ({
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok: true, errors: [] },
  tests: { ok: validationOk, passed: 9, failed: validationOk ? 0 : 1, output: "" },
  conformance: { ok: true, errors: [] },
  permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
  hash: sourcesRefused ? null : await hashSources(dir),
  ok: validationOk,
});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-publish-"));
  homes.push(home);
  ws = createWorkspaceDoc();
  project = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
  });
  updates = [];
  failFor = null;
  validationOk = true;
  sourcesRefused = false;
  const store = createFakeStore();
  const db = new Database(":memory:", { strict: true });
  ensureEventsTable(db);
  const common = { workspace: ws, persistWorkspace: () => undefined, emit: () => undefined };
  registry = createRegistryService({
    ...common,
    projects: () => [{ id: "p1", name: "Kibo", doc: project }],
    store,
    events: createEventLog(db),
    stopBackend: () => undefined,
    onApproved: async (id, v) => {
      await publisher.applyUpdateAll(id, v.version);
    },
  });
  publisher = createPublisher({
    ...common,
    home,
    store,
    registry,
    validate: report,
    signal: new AbortController().signal,
    update: async (_projectId, instanceId, to) => {
      if (instanceId === failFor) throw new KiboError("MIGRATION_FAILED", "config invalide");
      executeProjectCommand(project, {
        method: "setInstanceComponent",
        instanceId,
        component: `pr-queue@${to}`,
        config: {},
        data: null,
      });
      updates.push(`${instanceId}→${to}`);
    },
    now: () => 42,
  });
});

async function publishApproved(version: string) {
  writeDraft(version);
  const r = await publisher.publish("pr-queue", "new-version");
  const v = getRegistryVersion(ws, "pr-queue", version);
  await registry.approve("pr-queue", version, v?.hash ?? "", "sandboxed");
  return r;
}
function place(n: number): string[] {
  const page = addPage(project, { title: "Tableau de bord", kind: "dashboard" });
  return Array.from(
    { length: n },
    () => addInstance(project, { pageId: page.id, component: "pr-queue@0.3.0" }).id,
  );
}

describe("preview", () => {
  test("a first publication is new, needs approval and lists all permissions", async () => {
    writeDraft("0.1.0", { changes: ["Premier jet"] });
    const p = await publisher.preview("pr-queue");
    expect(p).toMatchObject({
      id: "pr-queue",
      from: null,
      to: "0.1.0",
      status: "new",
      usages: [],
      changes: ["Premier jet"],
      newPermissions: ["read:ticket"],
      migration: null,
    });
    const r = await publisher.publish("pr-queue", "new-version");
    expect(r).toMatchObject({ needsApproval: true, updated: [], failed: [] });
    expect(r.version).toMatchObject({
      version: "0.1.0",
      trust: null,
      origin: "user",
      publishedAt: 42,
      autoUpdate: false,
    });
  });
  test("same version: unchanged if same code, VERSION_EXISTS otherwise; lower versions refused", async () => {
    await publishApproved("0.3.0");
    expect((await publisher.preview("pr-queue")).status).toBe("unchanged");
    writeDraft("0.3.0", {}, "export function Component() { return 1; }");
    await expect(publisher.preview("pr-queue")).rejects.toThrow("VERSION_EXISTS");
    writeDraft("0.2.0");
    await expect(publisher.preview("pr-queue")).rejects.toThrow("INVALID_INPUT");
  });
  test("usages, new permissions and migration against the highest published version", async () => {
    await publishApproved("0.3.0");
    place(2);
    writeDraft("0.4.0", {
      net: ["api.github.com/graphql"],
      configVersion: 1,
      changes: ["Filtre par auteur de la PR"],
    });
    const p = await publisher.preview("pr-queue");
    expect(p).toMatchObject({
      from: "0.3.0",
      to: "0.4.0",
      status: "update",
      newPermissions: ["net:api.github.com/graphql"],
      migration: { from: 0, to: 1 },
      changes: ["Filtre par auteur de la PR"],
    });
    expect(p.usages.map((u) => [u.projectName, u.pageTitle, u.version])).toEqual([
      ["Kibo", "Tableau de bord", "0.3.0"],
      ["Kibo", "Tableau de bord", "0.3.0"],
    ]);
  });
  test("a failing validation is reported by preview and refused by publish", async () => {
    validationOk = false;
    writeDraft("0.1.0");
    expect((await publisher.preview("pr-queue")).validation.ok).toBe(false);
    await expect(publisher.publish("pr-queue", "new-version")).rejects.toThrow("VALIDATION_FAILED");
    await expect(publisher.preview("absent")).rejects.toThrow("NOT_FOUND");
  });
  test("a failing validation wins over an already published version", async () => {
    await publishApproved("0.3.0");
    writeDraft("0.3.0", {}, "export function Component() { return 1; }");
    validationOk = false;
    const red = await publisher.preview("pr-queue");
    expect(red).toMatchObject({ status: "update", from: "0.3.0", to: "0.3.0" });
    expect(red.validation.ok).toBe(false);
    sourcesRefused = true;
    const refused = await publisher.preview("pr-queue");
    expect(refused.hash).toBeNull();
    expect(refused.validation.ok).toBe(false);
    await expect(publisher.publish("pr-queue", "new-version")).rejects.toThrow("VALIDATION_FAILED");
  });
  test("a draft must stay inside the drafts folder", async () => {
    await expect(publisher.preview("../outside")).rejects.toThrow("INVALID_INPUT");
    const outside = mkdtempSync(join(tmpdir(), "kibo-outside-"));
    homes.push(outside);
    writeFileSync(
      join(outside, "kibo.component.json"),
      JSON.stringify({
        id: "linked",
        version: "0.1.0",
        kind: "widget",
        title: "Lien",
        reads: [],
        writes: [],
      }),
    );
    mkdirSync(draftsDir(home), { recursive: true });
    symlinkSync(outside, join(draftsDir(home), "linked"));
    await expect(publisher.preview("linked")).rejects.toThrow("INVALID_INPUT");
  });
});

describe("publish", () => {
  test("same permissions: trust is inherited and update-all migrates every instance", async () => {
    await publishApproved("0.3.0");
    const [a = "", b = ""] = place(2);
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "update-all");
    expect(r.needsApproval).toBe(false);
    expect(r.version).toMatchObject({ trust: "sandboxed", approvedHash: r.version.hash, autoUpdate: false });
    expect(updates.sort()).toEqual([`${a}→0.4.0`, `${b}→0.4.0`].sort());
    expect(r.updated.sort()).toEqual([a, b].sort());
  });
  test("partial failure: the other instances move on, the failing one is reported", async () => {
    await publishApproved("0.3.0");
    const [a = "", b = ""] = place(2);
    failFor = b;
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "update-all");
    expect(r.updated).toEqual([a]);
    expect(r.failed).toEqual([
      {
        instanceId: b,
        projectName: "Kibo",
        pageTitle: "Tableau de bord",
        code: "MIGRATION_FAILED",
        message: "config invalide",
      },
    ]);
  });
  test("a new permission defers update-all until approval, which then runs it once", async () => {
    await publishApproved("0.3.0");
    const [a] = place(1);
    writeDraft("0.4.0", { net: ["api.github.com/graphql"] });
    const r = await publisher.publish("pr-queue", "update-all");
    expect(r).toMatchObject({ needsApproval: true, updated: [], failed: [] });
    expect(r.version).toMatchObject({ trust: null, autoUpdate: true });
    expect(updates).toEqual([]);
    await registry.approve("pr-queue", "0.4.0", r.version.hash, "sandboxed");
    expect(updates).toEqual([`${a}→0.4.0`]);
  });
  test("new-version leaves instances where they are", async () => {
    await publishApproved("0.3.0");
    place(1);
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "new-version");
    expect(r.updated).toEqual([]);
    expect(updates).toEqual([]);
  });
  test("an ai version never inherits trust, even without new permissions", async () => {
    await publishApproved("0.3.0");
    place(1);
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "update-all", { origin: "ai" });
    expect(r.needsApproval).toBe(true);
    expect(r.version).toMatchObject({ version: "0.4.0", origin: "ai", trust: null, approvedHash: null });
    expect(r.updated).toEqual([]);
    expect(updates).toEqual([]);
  });
  test("a user version keeps inheriting trust (default origin)", async () => {
    await publishApproved("0.3.0");
    writeDraft("0.4.0");
    const r = await publisher.publish("pr-queue", "update-all");
    expect(r.version).toMatchObject({ origin: "user", trust: "sandboxed" });
    expect(r.needsApproval).toBe(false);
  });
  test("republishing an unchanged version keeps its origin", async () => {
    writeDraft("0.3.0");
    await publisher.publish("pr-queue", "new-version", { origin: "ai" });
    const r = await publisher.publish("pr-queue", "new-version");
    expect(r.version.origin).toBe("ai");
  });
});
