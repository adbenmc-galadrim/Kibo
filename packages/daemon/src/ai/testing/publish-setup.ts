import { Database } from "bun:sqlite";
import { afterEach } from "bun:test";
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
import { draftPaths, prepareDraft, readDraftManifest } from "../draft-files";
import { createDraftPublisher } from "../draft-publish";
import { openDraftStore } from "../draft-store";
import type { ComponentCatalog, PublishedComponent } from "../ports";
import { createFakeClock, createRecordingEvents } from "./fake-ports";

const roots: string[] = [];
export const cleanPublishHomes = () =>
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });
export const ID = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
export const hashOf = (dir: string) =>
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
  storedHash?: string;
};

export async function setup(opts: SetupOptions = {}) {
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
        opts.storedHash ?? hashOf(dir),
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

export const publishedAi: PublishedComponent = {
  version: "0.1.0",
  manifest,
  granted: { ...NO_PERMISSIONS, reads: ["ticket"] },
  origin: "ai",
};
