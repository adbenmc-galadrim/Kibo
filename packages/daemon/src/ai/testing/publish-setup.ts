import { Database } from "bun:sqlite";
import { afterEach } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type ComponentDraft,
  ComponentManifest,
  compareSemver,
  type DraftStatus,
  KiboError,
  NO_PERMISSIONS,
  type RegistryVersion,
  type ValidationReport,
} from "@kibo/schema";
import { draftPaths, prepareDraft, readDraftManifest, writeDraftManifest } from "../draft-files";
import { createDraftPublisher } from "../draft-publish";
import { type DraftStore, openDraftStore } from "../draft-store";
import type { ComponentCatalog, PublishedComponent } from "../ports";
import { createFakeClock, createRecordingEvents } from "./fake-ports";

const roots: string[] = [];
export const cleanPublishHomes = () =>
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });
export const ID = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
const hashContent = (parts: string[]) => createHash("sha256").update(parts.join("\0")).digest("hex");
export const hashOf = (dir: string) =>
  hashContent(
    ["kibo.component.json", "ui.tsx"].map((f) =>
      existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "",
    ),
  );
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

function mergedStores(current: DraftStore, legacy: DraftStore): DraftStore {
  const owner = (id: string) => (legacy.list().some((d) => d.id === id) ? legacy : current);
  return {
    insert: (d) => current.insert(d),
    save: (d) => owner(d.id).save(d),
    saveReport: (id, report) => owner(id).saveReport(id, report),
    get: (id) => owner(id).get(id),
    report: (id) => owner(id).report(id),
    list: () => [...current.list(), ...legacy.list()],
    active: () => [...current.active(), ...legacy.active()],
  };
}

type SetupOptions = {
  mode?: "create" | "modify";
  status?: DraftStatus;
  published?: PublishedComponent | null;
  publishFails?: boolean;
  alreadyApproved?: boolean;
  storedHash?: string;
  publishDelayMs?: number;
};

const draftOf = (id: string, mode: "create" | "modify", status: DraftStatus): ComponentDraft => ({
  id,
  componentId: "burndown",
  mode,
  title: "Burndown",
  kind: "widget",
  withServer: false,
  baseVersion: mode === "modify" ? "0.1.0" : null,
  description: "Ajoute un titre\net une légende",
  runId: "run-1",
  sessionId: "s1",
  status,
  attempts: 1,
  failure: null,
  incidents: [],
  createdAt: 1,
  updatedAt: 1,
});

async function prepareDraftDir(home: string, id: string, ui: string) {
  const paths = draftPaths(home, id);
  await prepareDraft({
    paths,
    kiboFiles: { "CLAUDE.md": "# Règles\n" },
    fill: async (dir) => {
      writeFileSync(join(dir, "kibo.component.json"), JSON.stringify(manifest));
      writeFileSync(join(dir, "ui.tsx"), "old");
    },
  });
  writeFileSync(join(paths.dir, "ui.tsx"), ui);
  return paths;
}

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
  const paths = await prepareDraftDir(home, ID, "new");
  const current = openDraftStore(new Database(":memory:", { strict: true }));
  const legacy = openDraftStore(new Database(":memory:", { strict: true }));
  const store = mergedStores(current, legacy);
  current.insert(draftOf(ID, mode, opts.status ?? "review"));
  current.saveReport(ID, green);
  const draftInto = (target: DraftStore) => async (id: string, ui: string, version: string) => {
    const p = await prepareDraftDir(home, id, ui);
    writeDraftManifest(p.dir, { ...readDraftManifest(p.dir), version });
    target.insert(draftOf(id, mode, "permissions"));
    target.saveReport(id, green);
    return p;
  };
  const addDraft = draftInto(current);
  const addLegacyDraft = draftInto(legacy);
  const registry = new Map<string, string>(
    opts.published ? [[opts.published.version, opts.published.hash]] : [],
  );
  const latestAi = (): PublishedComponent | null => {
    const top = [...registry.keys()].sort(compareSemver).at(-1);
    if (!top || top === opts.published?.version) return opts.published ?? null;
    return { version: top, manifest, granted: NO_PERMISSIONS, origin: "ai", hash: registry.get(top) ?? "" };
  };
  const published: string[] = [];
  const sources: string[] = [];
  const approved: unknown[] = [];
  const instances: string[] = [];
  const catalog: ComponentCatalog = {
    entries: () => [],
    isTaken: () => false,
    sourceDir: (id) => join(srcRoot, id),
    latest: latestAi,
    usages: () => [],
    publish: async (input) => {
      await Bun.sleep(opts.publishDelayMs ?? 0);
      if (opts.publishFails) throw new Error("build failed");
      const dir = join(srcRoot, input.id);
      const number = readDraftManifest(dir).version;
      const hash = (published.length === 0 ? opts.storedHash : undefined) ?? hashOf(dir);
      const existing = registry.get(number);
      if (existing !== undefined && existing !== hash)
        throw new KiboError("VERSION_EXISTS", `${number} is already published with another hash`);
      published.push(`${input.id}:${input.strategy}:${input.origin}`);
      sources.push(readFileSync(join(dir, "ui.tsx"), "utf8"));
      registry.set(number, hash);
      const version = stored(number, hash, opts.alreadyApproved ? "sandboxed" : null);
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
  return {
    home,
    srcRoot,
    paths,
    store,
    publisher,
    published,
    sources,
    approved,
    instances,
    diffs,
    addDraft,
    addLegacyDraft,
  };
}

export const publishedAi: PublishedComponent = {
  version: "0.1.0",
  manifest,
  granted: { ...NO_PERMISSIONS, reads: ["ticket"] },
  origin: "ai",
  hash: hashContent([JSON.stringify(manifest), "new"]),
};
