import { KiboError } from "@kibo/schema";
import { createBunSecretStore } from "./bun-secret-store";
import { migrateIntegrations } from "./db";
import { createEventLog, type EventLog } from "./events";
import { createMemorySecretStore } from "./memory-secret-store";
import { builtinProbes } from "./probes";
import type { Redactor } from "./redact";
import { createIntegrationRpc, type IntegrationRpc, NEUTRAL_HOOKS } from "./registry";
import { createSettings, type Settings } from "./settings";
import type {
  ComponentIntegrationHooks,
  IntegrationHandlers,
  IntegrationHost,
  IntegrationProbe,
  SecretStore,
} from "./types";

export type IntegrationFlags = { testOrigins: string[]; memorySecrets: boolean };
export type IntegrationKit = {
  host: IntegrationHost;
  flags: IntegrationFlags;
  redactor: Redactor;
  events: EventLog;
  settings: Settings;
  secrets: SecretStore;
  hooks: ComponentIntegrationHooks;
};
export type IntegrationModule = {
  handlers?: IntegrationHandlers;
  probes?: IntegrationProbe[];
  stop?: () => void;
};

export const NO_INTEGRATION_FLAGS: IntegrationFlags = { testOrigins: [], memorySecrets: false };

export function parseIntegrationFlags(values: {
  "test-origins"?: string;
  "memory-secrets"?: boolean;
}): IntegrationFlags {
  const testOrigins = (values["test-origins"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const memorySecrets = values["memory-secrets"] === true;
  if (memorySecrets && testOrigins.length === 0) {
    throw new KiboError("INVALID_INPUT", "--memory-secrets requires --test-origins");
  }
  return { testOrigins, memorySecrets };
}

function secretStoreFor(flags: IntegrationFlags, redactor: Redactor): SecretStore {
  if (flags.memorySecrets) return createMemorySecretStore(redactor);
  return createBunSecretStore(redactor);
}

export function startIntegrations(
  host: IntegrationHost,
  flags: IntegrationFlags,
  redactor: Redactor,
): IntegrationRpc {
  migrateIntegrations(host.db);
  if (flags.testOrigins.length > 0)
    console.warn(`[kibo-daemon] test origins enabled: ${flags.testOrigins.join(", ")}`);
  if (flags.memorySecrets) console.warn("[kibo-daemon] in-memory secret store (test mode)");
  const secrets = secretStoreFor(flags, redactor);
  const kit: IntegrationKit = {
    host,
    flags,
    redactor,
    events: createEventLog(host.db, redactor, host.now),
    settings: createSettings(host.db),
    secrets,
    hooks: { ...NEUTRAL_HOOKS, secret: (name) => secrets.get(name) },
  };
  const modules: IntegrationModule[] = [{ probes: builtinProbes(kit.host) }];
  return createIntegrationRpc({
    handlers: modules.flatMap((m) => (m.handlers ? [m.handlers] : [])),
    probes: modules.flatMap((m) => m.probes ?? []),
    stops: modules.flatMap((m) => (m.stop ? [m.stop] : [])),
    hooks: kit.hooks,
    redact: redactor.redact,
  });
}
