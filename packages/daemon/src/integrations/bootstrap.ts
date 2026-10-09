import { KiboError } from "@kibo/schema";
import { createCiStore } from "../ci/ci-store";
import { ciModule } from "../ci/module";
import { createCiPoller } from "../ci/poller";
import type { ServedFile } from "../components/file-response";
import { designModule } from "../design/module";
import { createEmbedChecker } from "../embed/embed-check";
import { createEmbedGate } from "../embed/embed-gate";
import { createEmbedService } from "../embed/embed-service";
import type { EmbedGate, EmbedService } from "../embed/types";
import { createGithubApi, type GithubApi } from "../github/api";
import { createGithubAccount, type GithubAccount } from "../github/auth";
import { githubModule } from "../github/handlers";
import { createMcpGate } from "../mcp/component-gate";
import { createMcpHub } from "../mcp/hub";
import { mcpModule } from "../mcp/module";
import { githubIssuesModule } from "../sync/adapter-module";
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

export type IntegrationFlags = { testOrigins: string[]; memorySecrets: boolean; devOrigins?: string[] };
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
  embed: EmbedService;
};
export type IntegrationNet = { fetch: IntegrationFetch; gate: RateLimitGate; aliases: Map<string, URL> };
export type IntegrationModule = {
  handlers?: IntegrationHandlers;
  probes?: IntegrationProbe[];
  stop?: () => void | Promise<void>;
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

export type StartedIntegrations = IntegrationRpc & {
  secrets: SecretStore;
  design: { open(token: string): Promise<ServedFile | null> };
  embed: EmbedGate;
  relay: EmbedService["relay"];
};

function secretStoreFor(flags: IntegrationFlags, redactor: Redactor): SecretStore {
  if (flags.memorySecrets) return createMemorySecretStore(redactor);
  return createBunSecretStore(redactor);
}

export function startIntegrations(
  host: IntegrationHost,
  flags: IntegrationFlags,
  redactor: Redactor,
): StartedIntegrations {
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
  const api = createGithubApi({
    fetch: net.fetch,
    token: () => account.token(),
    gate,
    onUnauthorized: () => account.forgetGhToken(),
  });
  const github = { account, api };
  const events = createEventLog(host.db, redactor, host.now);
  const ciStore = createCiStore(host.db);
  const ciPoller = createCiPoller({
    host,
    api,
    store: ciStore,
    events,
    connected: () => account.mode() !== null,
  });
  const secret: SecretResolver = (name) => (name === "github" ? account.token() : secrets.get(name));
  const mcpHub = createMcpHub({ host, secrets, events, redact: redactor.redact });
  const embedService = createEmbedService({
    now: host.now,
    sandboxOrigin: () => host.sandboxOrigin(),
    uiOrigins: () => host.uiOrigins(),
    devOrigins: flags.devOrigins ?? [],
    aliases,
  });
  const embedGate = createEmbedGate({
    service: embedService,
    checker: createEmbedChecker({ fetch: net.fetch, now: host.now, uiOrigins: () => host.uiOrigins() }),
  });
  const kit: IntegrationKit = {
    host,
    flags,
    redactor,
    events,
    settings,
    secrets,
    hooks: {
      ...NEUTRAL_HOOKS,
      aliases,
      observe,
      secret,
      ciRuns: (projectId) => ciPoller.runs(projectId, null),
      mcp: createMcpGate(mcpHub, host),
      embed: embedGate,
    },
    net,
    github,
    embed: embedService,
  };
  const design = designModule(kit, mcpHub);
  kit.hooks.design = design.gate;
  const modules: IntegrationModule[] = [
    { probes: builtinProbes(kit.host) },
    githubModule(kit, kit.github),
    ciModule(kit, ciPoller, ciStore),
    mcpModule(kit, mcpHub),
    design,
    githubIssuesModule(kit),
  ];
  const rpc = createIntegrationRpc({
    handlers: modules.flatMap((m) => (m.handlers ? [m.handlers] : [])),
    probes: modules.flatMap((m) => m.probes ?? []),
    stops: modules.flatMap((m) => (m.stop ? [m.stop] : [])),
    hooks: kit.hooks,
    redact: redactor.redact,
  });
  return {
    ...rpc,
    secrets,
    design: { open: design.open },
    embed: embedGate,
    relay: (token) => embedService.relay(token),
  };
}
