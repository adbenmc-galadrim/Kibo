import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ComponentDraft,
  ComponentManifest,
  type DraftStatus,
  NO_PERMISSIONS,
  type RegistryVersion,
  type ValidationReport,
} from "@kibo/schema";
import { draftPaths, prepareDraft, readDraftManifest } from "./draft-files";
import { createDraftPublisher } from "./draft-publish";
import { openDraftStore } from "./draft-store";
import type { ComponentCatalog, PublishedComponent } from "./ports";
import { createFakeClock, createRecordingEvents } from "./testing/fake-ports";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
const ID = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
const hashOf = (dir: string) =>
  createHash("sha256")
    .update(
      ["kibo.component.json", "ui.tsx"]
        .map((f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : ""))
        .join("\0"),
    )
    .digest("hex");
const manifest = ComponentManifest.parse({
  id: "burndown",
  version: "0.1.0",
  kind: "widget",
  title: "Burndown",
  reads: ["ticket"],
  writes: [],
});
const green: ValidationReport = {
  ok: true,
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok: true, errors: [] },
  tests: { ok: true, passed: 1, failed: 0, output: "" },
  conformance: { ok: true, errors: [] },
  permissions: { declared: ["read:ticket"], used: ["read:ticket"], missing: [], unused: [], errors: [] },
  hash: null,
};
const stored = (version: string, hash: string, trust: RegistryVersion["trust"]): RegistryVersion => ({
  version,
  hash,
  origin: "ai",
  trust,
  approvedHash: trust ? hash : null,
  granted: trust ? { ...NO_PERMISSIONS, reads: ["ticket"] } : NO_PERMISSIONS,
  publishedAt: 1,
  autoUpdate: false,
});

type SetupOptions = {
  mode?: "create" | "modify";
  status?: DraftStatus;
  published?: PublishedComponent | null;
  publishFails?: boolean;
  alreadyApproved?: boolean;
};

async function setup(opts: SetupOptions = {}) {
  const home = mkdtempSync(join(tmpdir(), "kibo-pub-"));
  roots.push(home);
  const mode = opts.mode ?? "create";
  const srcRoot = join(home, "components", "src");
  if (mode === "modify") {
    mkdirSync(join(srcRoot, "burndown"), { recursive: true });
    writeFileSync(join(srcRoot, "burndown", "kibo.component.json"), JSON.stringify(manifest));
    writeFileSync(join(srcRoot, "burndown", "ui.tsx"), "old");
  }
  const paths = draftPaths(home, ID);
  await prepareDraft({
    paths,
    kiboFiles: { "CLAUDE.md": "# Règles\n" },
    fill: async (dir) => {
      writeFileSync(join(dir, "kibo.component.json"), JSON.stringify(manifest));
      writeFileSync(join(dir, "ui.tsx"), "old");
    },
  });
  writeFileSync(join(paths.dir, "ui.tsx"), "new");
  const store = openDraftStore(new Database(":memory:", { strict: true }));
  const draft: ComponentDraft = {
    id: ID,
    componentId: "burndown",
    mode,
    title: "Burndown",
    kind: "widget",
    withServer: false,
    baseVersion: mode === "modify" ? "0.1.0" : null,
    description: "Ajoute un titre\net une légende",
    runId: "run-1",
    sessionId: "s1",
    status: opts.status ?? "review",
    attempts: 1,
    failure: null,
    incidents: [],
    createdAt: 1,
    updatedAt: 1,
  };
  store.insert(draft);
  store.saveReport(ID, green);
  const published: string[] = [];
  const approved: unknown[] = [];
  const instances: string[] = [];
  const catalog: ComponentCatalog = {
    entries: () => [],
    isTaken: () => false,
    sourceDir: (id) => join(srcRoot, id),
    latest: () => opts.published ?? null,
    usages: () => [],
    publish: async (input) => {
      if (opts.publishFails) throw new Error("build failed");
      published.push(`${input.id}:${input.strategy}:${input.origin}`);
      const dir = join(srcRoot, input.id);
      const version = stored(
        readDraftManifest(dir).version,
        hashOf(dir),
        opts.alreadyApproved ? "sandboxed" : null,
      );
      return { version, needsApproval: !opts.alreadyApproved, updated: [], failed: [] };
    },
    approve: async (input) => {
      approved.push(input);
      return stored(input.version, input.hash, input.trust);
    },
  };
  const diffs: string[] = [];
  const publisher = createDraftPublisher({
    store,
    devkit: {
      scaffold: async () => {},
      infer: async () => NO_PERMISSIONS,
      validate: async () => green,
      hash: async (dir) => hashOf(dir),
    },
    catalog,
    projects: {
      pageExists: (projectId, pageId) => projectId === "p1" && pageId === "pg1",
      addInstance: async (_p, pageId, ref) => {
        instances.push(ref);
        return { id: "i1", pageId, component: ref, layout: { x: 0, y: 0, w: 4, h: 3 }, config: {} };
      },
    },
    differ: async ({ path }) => {
      diffs.push(path);
      return {
        path,
        origPath: null,
        binary: false,
        hunkStaging: false,
        additions: 1,
        deletions: 1,
        hunks: [],
      };
    },
    events: createRecordingEvents(),
    clock: createFakeClock(),
    home,
  });
  return { home, srcRoot, paths, store, publisher, published, approved, instances, diffs };
}

const published: PublishedComponent = {
  version: "0.1.0",
  manifest,
  granted: { ...NO_PERMISSIONS, reads: ["ticket"] },
  origin: "ai",
};

describe("details", () => {
  test("create: diff of changed agent files, version 0.1.0, every permission is new, no hash yet", async () => {
    const { publisher, diffs } = await setup();
    const d = await publisher.details(ID);
    expect(diffs).toEqual(["ui.tsx"]);
    expect(d.manifest?.id).toBe("burndown");
    expect(d.publish).toMatchObject({
      id: "burndown",
      title: "Burndown",
      from: null,
      to: "0.1.0",
      status: "new",
      newPermissions: ["read:ticket"],
      hash: null,
      changes: [],
      migration: null,
      validation: { ok: true },
    });
  });
  test("modify: patch proposed and the first line of the request as change", async () => {
    const { publisher } = await setup({ mode: "modify", published });
    expect((await publisher.details(ID)).publish).toMatchObject({
      from: "0.1.0",
      to: "0.1.1",
      status: "update",
      changes: ["Ajoute un titre"],
      newPermissions: [],
    });
  });
  test("no diff, manifest nor preview before review", async () => {
    const { publisher } = await setup({ status: "failed" });
    expect(await publisher.details(ID)).toMatchObject({ diff: [], manifest: null, publish: null });
  });
});

describe("review", () => {
  test("writes version and changes, moves to permissions, exposes the hash", async () => {
    const { publisher, paths } = await setup({ mode: "modify", published });
    const d = await publisher.review({ draftId: ID, version: "0.1.1", changes: ["Ajoute un titre"] });
    expect(d.status).toBe("permissions");
    expect(readDraftManifest(paths.dir)).toMatchObject({ version: "0.1.1", changes: ["Ajoute un titre"] });
    expect(d.publish).toMatchObject({ to: "0.1.1", hash: hashOf(paths.dir), changes: ["Ajoute un titre"] });
  });
  test("refuses a version not above the published one, or a draft not in review", async () => {
    const { publisher } = await setup({ mode: "modify", published });
    await expect(publisher.review({ draftId: ID, version: "0.1.0", changes: [] })).rejects.toThrow(
      "INVALID_INPUT",
    );
    const created = await setup({ published: { ...published, origin: "user" } });
    await expect(created.publisher.review({ draftId: ID, version: "0.1.0", changes: [] })).rejects.toThrow(
      "INVALID_INPUT",
    );
    const other = await setup({ status: "failed" });
    await expect(other.publisher.review({ draftId: ID, version: "0.1.0", changes: [] })).rejects.toThrow(
      "INVALID_INPUT",
    );
  });
});

describe("finalize", () => {
  const input = (hash: string) => ({
    draftId: ID,
    version: "0.1.0",
    hash,
    trust: "sandboxed" as const,
    strategy: "update-all" as const,
    target: { projectId: "p1", pageId: "pg1" },
  });

  test("installs the source without Kibo files, publishes as ai, approves the stored hash, adds the instance", async () => {
    const s = await setup({ status: "permissions" });
    const hash = hashOf(s.paths.dir);
    const result = await s.publisher.finalize(input(hash));
    expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("new");
    expect(existsSync(join(s.srcRoot, "burndown", "CLAUDE.md"))).toBe(false);
    expect(s.published).toEqual(["burndown:update-all:ai"]);
    expect(s.approved).toEqual([{ id: "burndown", version: "0.1.0", hash, trust: "sandboxed" }]);
    expect(s.instances).toEqual(["burndown@0.1.0"]);
    expect(result).toMatchObject({
      version: { version: "0.1.0", trust: "sandboxed" },
      instanceId: "i1",
      publish: { needsApproval: true },
    });
    expect(s.store.get(ID).status).toBe("done");
    expect(existsSync(s.paths.dir)).toBe(false);
  });

  test("an already approved republication is not approved twice", async () => {
    const s = await setup({ status: "permissions", alreadyApproved: true });
    const result = await s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null });
    expect(s.approved).toEqual([]);
    expect(result).toMatchObject({ version: { trust: "sandboxed" }, instanceId: null });
  });

  test("a changed draft is HASH_MISMATCH and nothing is published", async () => {
    const s = await setup({ status: "permissions" });
    await expect(s.publisher.finalize(input("b".repeat(64)))).rejects.toThrow("HASH_MISMATCH");
    expect(s.published).toEqual([]);
  });

  test("a double click publishes once", async () => {
    const s = await setup({ status: "permissions" });
    const hash = hashOf(s.paths.dir);
    const results = await Promise.allSettled([
      s.publisher.finalize(input(hash)),
      s.publisher.finalize(input(hash)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(s.published).toHaveLength(1);
  });

  test("a missing page is refused before publishing", async () => {
    const s = await setup({ status: "permissions" });
    await expect(
      s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: { projectId: "p1", pageId: "gone" } }),
    ).rejects.toThrow("NOT_FOUND");
    expect(s.published).toEqual([]);
  });

  test("modify: a failed publication restores the previous source", async () => {
    const s = await setup({ mode: "modify", status: "permissions", published, publishFails: true });
    await expect(s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null })).rejects.toThrow(
      "build failed",
    );
    expect(readFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "utf8")).toBe("old");
    expect(s.store.get(ID).status).toBe("permissions");
  });

  test("modify: a source edited since the draft started is CONFLICT", async () => {
    const s = await setup({ mode: "modify", status: "permissions", published });
    writeFileSync(join(s.srcRoot, "burndown", "ui.tsx"), "edited by hand");
    await expect(s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null })).rejects.toThrow(
      "CONFLICT",
    );
  });

  test("the same version published by the user is refused, never reused without the trust screen", async () => {
    for (const mode of ["create", "modify"] as const) {
      const s = await setup({ mode, status: "permissions", published: { ...published, origin: "user" } });
      const pending = s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null });
      await expect(pending).rejects.toThrow("INVALID_INPUT");
      expect(s.published).toEqual([]);
      expect(s.store.get(ID).status).toBe("permissions");
    }
  });

  test("a version below the published one is refused", async () => {
    const s = await setup({
      mode: "modify",
      status: "permissions",
      published: { ...published, version: "0.2.0" },
    });
    await expect(s.publisher.finalize({ ...input(hashOf(s.paths.dir)), target: null })).rejects.toThrow(
      "INVALID_INPUT",
    );
    expect(s.published).toEqual([]);
  });
});
