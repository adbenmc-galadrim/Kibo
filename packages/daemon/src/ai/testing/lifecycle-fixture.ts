import { Database } from "bun:sqlite";
import { afterEach } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AiStatus,
  ComponentManifest,
  KiboError,
  NO_PERMISSIONS,
  type ValidationReport,
} from "@kibo/schema";
import { verifyAndRestore } from "../draft-files";
import { createDraftLifecycle } from "../draft-lifecycle";
import { openDraftStore } from "../draft-store";
import type { AiAvailability, ComponentCatalog, Devkit, PublishedComponent } from "../ports";
import { createFakeClock, createFakeRuns, createRecordingEvents } from "./fake-ports";

const roots: string[] = [];

export const cleanLifecycles = () =>
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

export const report = (ok: boolean, missing: string[] = []): ValidationReport => ({
  ok: ok && missing.length === 0,
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok, errors: ok ? [] : ["ui.tsx(3,7): error TS2322"] },
  tests: { ok: true, passed: 1, failed: 0, output: "" },
  conformance: { ok: missing.length === 0, errors: [] },
  permissions: { declared: [], used: missing, missing, unused: [], errors: [] },
  hash: null,
});

export function setupLifecycle(
  opts: {
    status?: Partial<AiStatus>;
    published?: PublishedComponent | null;
    reports?: ValidationReport[];
    withoutSdk?: boolean;
  } = {},
) {
  const home = mkdtempSync(join(tmpdir(), "kibo-life-"));
  roots.push(home);
  const sdkDir = join(home, "sdk");
  mkdirSync(sdkDir);
  const runs = createFakeRuns();
  const clock = createFakeClock();
  const events = createRecordingEvents();
  const store = openDraftStore(new Database(":memory:", { strict: true }));
  const reports = [...(opts.reports ?? [report(true)])];
  const inferred: string[] = [];
  let validations = 0;
  let inferError: KiboError | null = null;
  let inferGate: Promise<void> = Promise.resolve();
  let published = opts.published ?? null;
  let restoreError: string | null = null;
  const devkit: Devkit = {
    scaffold: async ({ dir, id, title, kind }) => {
      writeFileSync(
        join(dir, "kibo.component.json"),
        JSON.stringify({ id, version: "0.1.0", kind, title, reads: [], writes: [] }),
      );
      writeFileSync(join(dir, "ui.tsx"), "export const Component = () => null;\n");
      writeFileSync(join(dir, "component.test.tsx"), "runConformance({ manifest, Component });\n");
    },
    infer: async (dir) => {
      inferred.push(dir);
      await inferGate;
      if (inferError) throw inferError;
      return { ...NO_PERMISSIONS, reads: ["ticket"] };
    },
    validate: async () => {
      validations++;
      return reports.shift() ?? report(true);
    },
    hash: async () => "a".repeat(64),
  };
  const srcRoot = join(home, "components", "src");
  const catalog: ComponentCatalog = {
    entries: () => [],
    isTaken: (id) => id === "kanban" || existsSync(join(srcRoot, id)),
    sourceDir: (id) => join(srcRoot, id),
    latest: () => published,
    usages: () => [],
    publish: async () => {
      throw new Error("not used by the lifecycle");
    },
    approve: async () => {
      throw new Error("not used by the lifecycle");
    },
  };
  const status: AiStatus = {
    available: true,
    reason: null,
    version: "2.1.283",
    loggedIn: true,
    profiles: { assistant: true, generateur: true },
    ...opts.status,
  };
  const ai: AiAvailability = {
    status: () => status,
    capabilities: () => null,
    refresh: async () => status,
    settled: async () => status,
  };
  const opened: string[] = [];
  let n = 0;
  const life = createDraftLifecycle({
    store,
    runs,
    devkit,
    catalog,
    ai,
    events,
    clock,
    editor: { openFolder: async (dir) => void opened.push(dir) },
    home,
    sdkDir: opts.withoutSdk ? null : sdkDir,
    args: () => ["--tools", "Read,Edit,Write,Glob,Grep,Bash"],
    env: () => ({ PATH: "/kibo/bin" }),
    newId: () => `0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a1${n++}`,
    restore: (paths, allowServer) => {
      if (restoreError) throw new KiboError("STORE_CORRUPT", restoreError);
      return verifyAndRestore(paths, allowServer);
    },
  });
  return {
    home,
    srcRoot,
    runs,
    events,
    store,
    life,
    inferred,
    opened,
    validations: () => validations,
    setInferError: (e: KiboError) => {
      inferError = e;
    },
    holdInfer: () => {
      let release = () => {};
      inferGate = new Promise((resolve) => {
        release = resolve;
      });
      return () => release();
    },
    setPublished: (p: PublishedComponent | null) => {
      published = p;
    },
    failRestore: (detail: string | null) => {
      restoreError = detail;
    },
  };
}

export const create = {
  mode: "create",
  id: "burndown",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  description: "Burndown du sprint : tickets restants par jour.",
} as const;
export const done = (sessionId = "s1") => ({ state: "done", sessionId, stdout: "", error: null }) as const;

export const burndownAt = (version: string): PublishedComponent => ({
  version,
  manifest: ComponentManifest.parse({
    id: "burndown",
    version,
    kind: "widget",
    title: "Burndown",
    reads: ["ticket"],
    writes: [],
  }),
  granted: { ...NO_PERMISSIONS, reads: ["ticket"] },
  origin: "ai",
  hash: `hash-${version}`,
});

export function writeSource(srcRoot: string): string {
  const src = join(srcRoot, "burndown");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "kibo.component.json"), JSON.stringify(burndownAt("0.1.0").manifest));
  writeFileSync(join(src, "ui.tsx"), "old");
  writeFileSync(join(src, "component.test.tsx"), "runConformance(x);\n");
  return src;
}
