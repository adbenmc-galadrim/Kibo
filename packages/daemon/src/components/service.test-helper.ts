import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildOutput } from "@kibo/devkit";
import { hashSources } from "@kibo/devkit";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import {
  ComponentManifest,
  type ComponentManifestInput,
  type Instance,
  type Page,
  type RpcRequest,
  type RpcResult,
  type TicketRun,
  type ValidationReport,
} from "@kibo/schema";
import { createService, type Service } from "../service";
import { openStore, type Store } from "../store";
import { draftsDir } from "./drafts";
import type { JobSchedulerDeps } from "./jobs";
import { type ComponentsService, createComponentsService } from "./service";

export const SANDBOX_ORIGIN = "http://127.0.0.1:4318";

const enc = (s: string) => new TextEncoder().encode(s);
const optional = async (path: string) => {
  const file = Bun.file(path);
  return (await file.exists()) ? await file.text() : null;
};

export const fakeBuild = async (srcDir: string): Promise<BuildOutput> => {
  const manifest = ComponentManifest.parse(
    JSON.parse(await Bun.file(join(srcDir, "kibo.component.json")).text()),
  );
  const server = await optional(join(srcDir, "server.ts"));
  const migrations = await optional(join(srcDir, "migrations.ts"));
  return {
    manifest,
    files: {
      "ui.sandbox.js": enc(`sandbox:${manifest.version}`),
      "ui.trusted.js": enc(`trusted:${manifest.version}`),
      "ui.css": enc(".c{}"),
      ...(server !== null && { "server.js": enc(server) }),
      ...(migrations !== null && { "migrations.js": enc(migrations) }),
    },
  };
};

export const okReport = async (dir: string): Promise<ValidationReport> => ({
  manifest: { ok: true, errors: [] },
  imports: { ok: true, errors: [] },
  typecheck: { ok: true, errors: [] },
  tests: { ok: true, passed: 1, failed: 0, output: "" },
  conformance: { ok: true, errors: [] },
  permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
  hash: await hashSources(dir),
  ok: true,
});

export type DraftOptions = Partial<ComponentManifestInput> & { server?: string; migrations?: string };

export function writeDraft(home: string, version: string, opts: DraftOptions = {}): void {
  const { server, migrations, ...manifest } = opts;
  const dir = join(draftsDir(home), "hello");
  mkdirSync(dir, { recursive: true });
  const base = {
    id: "hello",
    version,
    kind: "both",
    title: "Hello",
    reads: ["ticket"],
    writes: [],
    data: true,
  };
  writeFileSync(join(dir, "kibo.component.json"), JSON.stringify({ ...base, ...manifest }));
  writeFileSync(join(dir, "ui.tsx"), `export function Component() { return "${version}"; }`);
  if (server !== undefined) writeFileSync(join(dir, "server.ts"), server);
  if (migrations !== undefined) writeFileSync(join(dir, "migrations.ts"), migrations);
}

export type Timers = { started: string[] } & Pick<JobSchedulerDeps, "setInterval" | "clearInterval">;

export function fakeTimers(): Timers {
  const started: string[] = [];
  return {
    started,
    setInterval: (_fn, ms) => {
      started.push(String(ms));
      return started.length;
    },
    clearInterval: () => {},
  };
}

export type Harness = {
  store: Store;
  service: Service;
  components: ComponentsService;
  rpc<R extends RpcRequest>(req: R): Promise<RpcResult[R["method"]]>;
  stop(): Promise<void>;
};

export type HarnessOptions = {
  runs?: (projectId: string) => TicketRun[];
  timers?: Timers;
  validate?: (dir: string, signal: AbortSignal) => Promise<ValidationReport>;
  drainMs?: number;
};

export async function boot(home: string, opts: HarnessOptions = {}): Promise<Harness> {
  const store = openStore(home);
  const service = createService(store, { user: "adam" });
  const components = createComponentsService({
    home,
    toolchain: DEV_TOOLCHAIN,
    db: store.db,
    docs: service.docs,
    sandboxOrigin: () => SANDBOX_ORIGIN,
    runs: opts.runs ?? (() => []),
    build: fakeBuild,
    validate: opts.validate ?? okReport,
    ...(opts.timers && { jobTimers: opts.timers }),
    ...(opts.drainMs !== undefined && { drainMs: opts.drainMs }),
  });
  const detach = service.attachComponents(components);
  await components.start();
  return {
    store,
    service,
    components,
    rpc: async <R extends RpcRequest>(req: R) => (await service.handle(req)) as RpcResult[R["method"]],
    async stop() {
      detach();
      await components.stop();
      store.close();
    },
  };
}

export async function createProject(h: Harness): Promise<{ projectId: string; pageId: string }> {
  const meta = await h.rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const page = (await h.rpc({
    method: "command",
    projectId: meta.id,
    command: { method: "addPage", title: "Tableau de bord", kind: "dashboard" },
  })) as Page;
  return { projectId: meta.id, pageId: page.id };
}

export async function publishAndApprove(
  h: Harness,
  trust: "trusted" | "sandboxed" = "sandboxed",
): Promise<{ hash: string }> {
  const published = await h.rpc({
    method: "publishComponent",
    id: "hello",
    strategy: "new-version",
  });
  const { hash, version } = published.version;
  await h.rpc({ method: "approveComponent", id: "hello", version, hash, trust });
  return { hash };
}

export async function addInstance(h: Harness, projectId: string, pageId: string, component: string) {
  const inst = await h.rpc({
    method: "command",
    projectId,
    command: { method: "addInstance", pageId, component },
  });
  return inst as Instance;
}
