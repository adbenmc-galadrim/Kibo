import { KiboError } from "@kibo/schema";
import { createGithubApi, type GithubApi } from "../github/api";
import { createGithubAccount, type GithubAccount } from "../github/auth";
import { githubModule } from "../github/handlers";
import { createBunSecretStore } from "./bun-secret-store";
import { migrateIntegrations } from "./db";
import { createEventLog, type EventLog } from "./events";
import { createMemorySecretStore } from "./memory-secret-store";
import { createIntegrationFetch, GITHUB_API, parseTestOrigins } from "./net";
import { builtinProbes } from "./probes";
import { createRateLimitGate, type RateLimitGate } from "./rate-limit";
import type { Redactor } from "./redact";
import { createIntegrationRpc, type IntegrationRpc, NEUTRAL_HOOKS } from "./registry";
import { createSettings, type Settings } from "./settings";
import type {
  ComponentIntegrationHooks,
  IntegrationFetch,
  IntegrationHandlers,
  IntegrationHost,
  IntegrationProbe,
  SecretResolver,
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
  net: IntegrationNet;
  github: { account: GithubAccount; api: GithubApi };
};
export type IntegrationNet = { fetch: IntegrationFetch; gate: RateLimitGate; aliases: Map<string, URL> };
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
  parseTestOrigins(testOrigins);
  const memorySecrets = values["memory-secrets"] === true;
  if (memorySecrets && testOrigins.length === 0) {
    throw new KiboError("INVALID_INPUT", "--memory-secrets requires --test-origins");
  }
  if (!memorySecrets && testOrigins.length > 0) {
    throw new KiboError("INVALID_INPUT", "--test-origins requires --memory-secrets");
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
  const aliases = parseTestOrigins(flags.testOrigins);
  const gate = createRateLimitGate(host.now);
  const observe = (h: string, headers: Headers) => {
    if (h === GITHUB_API) gate.observe(headers);
  };
  const net: IntegrationNet = { fetch: createIntegrationFetch({ aliases, observe }), gate, aliases };
  const settings = createSettings(host.db);
  const account = createGithubAccount({
    settings,
    secrets,
    redactor,
    gh: host.gh,
    fetch: net.fetch,
    now: host.now,
  });
  const github = { account, api: createGithubApi({ fetch: net.fetch, token: () => account.token(), gate }) };
  const secret: SecretResolver = (name) => (name === "github" ? account.token() : secrets.get(name));
  const kit: IntegrationKit = {
    host,
    flags,
    redactor,
    events: createEventLog(host.db, redactor, host.now),
    settings,
    secrets,
    hooks: { ...NEUTRAL_HOOKS, aliases, observe, secret },
    net,
    github,
  };
  const modules: IntegrationModule[] = [{ probes: builtinProbes(kit.host) }, githubModule(kit, kit.github)];
  return createIntegrationRpc({
    handlers: modules.flatMap((m) => (m.handlers ? [m.handlers] : [])),
    probes: modules.flatMap((m) => m.probes ?? []),
    stops: modules.flatMap((m) => (m.stop ? [m.stop] : [])),
    hooks: kit.hooks,
    redact: redactor.redact,
  });
}
