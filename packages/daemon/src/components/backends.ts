import {
  applyMigrations,
  type BackendCode,
  type BackendDescription,
  type ComponentManifest,
  ComponentRef,
  KiboError,
} from "@kibo/schema";
import type { BackendHost, CallHandler, HostOptions } from "./host-core";
import { createProcessHost } from "./process-host";
import type { MigrateRequest } from "./update";
import { createWorkerHost } from "./worker-host";

type Json = Record<string, unknown>;
type Trust = "trusted" | "sandboxed";
export type BackendSource = { manifest: ComponentManifest; code: BackendCode; trust: Trust };
export type BackendsDeps = {
  source(ref: string): BackendSource | null;
  verify(ref: string): Promise<void>;
  onCall: CallHandler;
  processCommand?: string[];
  hostOptions?: Partial<HostOptions>;
};
export type ActionRequest = {
  projectId: string;
  instanceId: string;
  config: Json;
  name: string;
  input: unknown;
};
export type JobRequest = { projectId: string; instanceId: string; config: Json; job: string };
export type Backends = {
  action(ref: string, req: ActionRequest): Promise<unknown>;
  migrate(ref: string, req: MigrateRequest): Promise<{ config: Json; data: Json }>;
  runJob(ref: string, req: JobRequest): Promise<void>;
  describe(ref: string): Promise<BackendDescription>;
  stop(ref: string): void;
  stopAll(): void;
  running(): string[];
};

const isRecord = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export function createBackends(deps: BackendsDeps): Backends {
  const hosts = new Map<string, { host: BackendHost; trust: Trust }>();

  const sourceOf = (ref: string): BackendSource => {
    if (!ComponentRef.safeParse(ref).success)
      throw new KiboError("INVALID_INPUT", `invalid component ref ${ref}`);
    const source = deps.source(ref);
    if (!source) throw new KiboError("TRUST_REQUIRED", `${ref} is not approved`);
    return source;
  };
  const hostFor = (ref: string, source: BackendSource): BackendHost => {
    const existing = hosts.get(ref);
    if (existing && existing.trust === source.trust) return existing.host;
    existing?.host.stop();
    const opts: HostOptions = {
      ref,
      manifest: source.manifest,
      code: source.code,
      onCall: deps.onCall,
      beforeStart: () => deps.verify(ref),
      ...deps.hostOptions,
    };
    const host =
      source.trust === "trusted"
        ? createWorkerHost(opts)
        : createProcessHost({ ...opts, ...(deps.processCommand && { command: deps.processCommand }) });
    hosts.set(ref, { host, trust: source.trust });
    return host;
  };

  return {
    async action(ref, req) {
      const source = sourceOf(ref);
      if (!source.code.server) throw new KiboError("PERMISSION_DENIED", `${ref} has no server`);
      const { name, ...rest } = req;
      return hostFor(ref, source).invoke({ ...rest, target: { action: name } });
    },
    async migrate(ref, req) {
      const source = sourceOf(ref);
      const input = { config: req.config, data: req.data };
      if (!source.code.migrations) return applyMigrations({}, req.from, req.to, input);
      const out = await hostFor(ref, source).invoke({
        projectId: req.projectId,
        instanceId: req.instanceId,
        config: req.config,
        target: { migrate: { from: req.from, to: req.to, ...input } },
        input: null,
      });
      if (!isRecord(out) || !isRecord(out.config) || !isRecord(out.data)) {
        throw new KiboError("MIGRATION_FAILED", `${ref} returned an invalid migration result`);
      }
      return { config: out.config, data: out.data };
    },
    async runJob(ref, req) {
      const source = sourceOf(ref);
      const { job, ...rest } = req;
      await hostFor(ref, source).invoke({ ...rest, target: { job }, input: null });
    },
    async describe(ref) {
      const source = sourceOf(ref);
      if (!source.code.server) return { actions: [], jobs: [] };
      return hostFor(ref, source).describe();
    },
    stop(ref) {
      hosts.get(ref)?.host.stop();
      hosts.delete(ref);
    },
    stopAll() {
      for (const { host } of hosts.values()) host.stop();
      hosts.clear();
    },
    running: () => [...hosts.keys()],
  };
}
