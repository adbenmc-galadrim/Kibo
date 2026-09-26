import { join } from "node:path";
import { type BuiltinBackend, buildBuiltinBackend, readBuiltinBackend } from "@kibo/devkit";
import {
  BINDING_PREFIX,
  type Binding,
  type BindingConfig,
  type ComponentManifest,
  KiboError,
} from "@kibo/schema";
import type { BackendHost, CallHandler } from "../components/host-core";
import { createWorkerHost } from "../components/worker-host";

export type AdapterInvoker = (req: {
  projectId: string;
  bindingId: string;
  adapter: Binding["adapter"];
  config: BindingConfig;
  action: "adapter.pull" | "adapter.push";
  input: unknown;
}) => Promise<unknown>;
export type AdapterHostsDeps = {
  load(id: Binding["adapter"]): Promise<BuiltinBackend>;
  calls(manifest: ComponentManifest): CallHandler;
  timeoutMs?: number;
};
export type AdapterHosts = { invoke: AdapterInvoker; stop(): void };

export const ADAPTER_TIMEOUT_MS = 120_000;
const REPO_COMPONENTS = join(import.meta.dir, "..", "..", "..", "..", "components");

export function loadBuiltinAdapter(
  id: string,
  env: Record<string, string | undefined> = process.env,
): Promise<BuiltinBackend> {
  const packaged = env.KIBO_BUILTIN_DIR;
  return packaged ? readBuiltinBackend(join(packaged, id)) : buildBuiltinBackend(join(REPO_COMPONENTS, id));
}

export function createAdapterHosts(deps: AdapterHostsDeps): AdapterHosts {
  const hosts = new Map<string, Promise<BackendHost>>();
  const start = async (id: Binding["adapter"]): Promise<BackendHost> => {
    const b = await deps.load(id);
    if (b.manifest.kind !== "adapter" || b.manifest.id !== id)
      throw new KiboError("INTERNAL", `${id} is not a builtin adapter`);
    return createWorkerHost({
      ref: `${b.manifest.id}@${b.manifest.version}`,
      manifest: b.manifest,
      code: { server: b.server, migrations: null },
      onCall: deps.calls(b.manifest),
      timeoutMs: deps.timeoutMs ?? ADAPTER_TIMEOUT_MS,
    });
  };
  const hostOf = (id: Binding["adapter"]): Promise<BackendHost> => {
    const known = hosts.get(id);
    if (known) return known;
    const next = start(id);
    hosts.set(id, next);
    next.catch(() => {
      if (hosts.get(id) === next) hosts.delete(id);
    });
    return next;
  };
  return {
    invoke: async (req) =>
      (await hostOf(req.adapter)).invoke({
        projectId: req.projectId,
        instanceId: `${BINDING_PREFIX}${req.bindingId}`,
        config: req.config,
        target: { action: req.action },
        input: req.input,
      }),
    stop() {
      for (const host of hosts.values())
        host.then(
          (h) => h.stop(),
          () => undefined,
        );
      hosts.clear();
    },
  };
}
