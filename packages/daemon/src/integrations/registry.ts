import { IntegrationId, type IntegrationRpcRequest, type IntegrationStatus, KiboError } from "@kibo/schema";
import type { ComponentIntegrationHooks, IntegrationHandlers, IntegrationProbe } from "./types";

export type IntegrationRpc = {
  handles(method: string): boolean;
  handle(req: IntegrationRpcRequest): Promise<unknown>;
  stop(): void;
  hooks: ComponentIntegrationHooks;
};
type AnyHandler = (req: IntegrationRpcRequest) => Promise<unknown>;

const BUILTIN_METHODS: ReadonlySet<string> = new Set([
  "listIntegrations",
  "testIntegration",
  "disconnectIntegration",
]);

export const NEUTRAL_HOOKS: ComponentIntegrationHooks = {
  aliases: new Map(),
  observe: () => undefined,
  secret: async () => null,
  mcp: null,
  ciRuns: null,
};

function errorStatus(id: IntegrationId, e: unknown): IntegrationStatus {
  if (!(e instanceof KiboError)) console.error(`[kibo-daemon] probe ${id} failed`, e);
  return {
    id,
    state: "error",
    account: null,
    servers: [],
    error:
      e instanceof KiboError
        ? { code: e.code, message: e.detail }
        : { code: "INTERNAL", message: "probe failed" },
    resumeAt: null,
  };
}

async function probeStatus(
  id: IntegrationId,
  fn: () => Promise<IntegrationStatus>,
): Promise<IntegrationStatus> {
  try {
    return await fn();
  } catch (e) {
    return errorStatus(id, e);
  }
}

function handlerTable(groups: IntegrationHandlers[]): Map<string, AnyHandler> {
  const table = new Map<string, AnyHandler>();
  for (const group of groups) {
    for (const [method, fn] of Object.entries(group)) {
      if (table.has(method) || BUILTIN_METHODS.has(method))
        throw new KiboError("INTERNAL", `duplicate integration handler ${method}`);
      if (typeof fn === "function") table.set(method, fn as AnyHandler);
    }
  }
  return table;
}

export function createIntegrationRpc(parts: {
  handlers: IntegrationHandlers[];
  probes: IntegrationProbe[];
  stops: (() => void)[];
  hooks?: ComponentIntegrationHooks;
}): IntegrationRpc {
  const table = handlerTable(parts.handlers);
  const probes = new Map<IntegrationId, IntegrationProbe>();
  for (const p of parts.probes) {
    if (probes.has(p.id)) throw new KiboError("INTERNAL", `duplicate integration probe ${p.id}`);
    probes.set(p.id, p);
  }
  const listed = () =>
    IntegrationId.options.flatMap((id) => {
      const p = probes.get(id);
      return p ? [p] : [];
    });
  return {
    handles: (method) => BUILTIN_METHODS.has(method) || table.has(method),
    async handle(req) {
      if (req.method === "listIntegrations") {
        return Promise.all(listed().map((p) => probeStatus(p.id, () => p.status())));
      }
      if (req.method === "testIntegration") {
        const p = probes.get(req.id);
        if (!p) throw new KiboError("NOT_FOUND", `no probe for ${req.id}`);
        return probeStatus(p.id, () => (p.test ? p.test() : p.status()));
      }
      if (req.method === "disconnectIntegration") {
        const p = probes.get(req.id);
        if (!p?.disconnect) throw new KiboError("NOT_FOUND", `${req.id} cannot be disconnected`);
        await p.disconnect();
        return null;
      }
      const fn = table.get(req.method);
      if (!fn) throw new KiboError("NOT_FOUND", `no handler for ${req.method}`);
      return fn(req);
    },
    stop() {
      for (const s of parts.stops) s();
    },
    hooks: parts.hooks ?? NEUTRAL_HOOKS,
  };
}
