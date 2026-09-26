import type { Toolchain } from "@kibo/devkit";
import { type HostLoad, type Session, ticketRuns } from "@kibo/schema";
import { defaultHookLauncher } from "./agents/hook-launcher";
import { createLoadSampler, readHostInfo } from "./agents/host-load";
import type { Notice } from "./agents/notifier";
import { createOrchestrator, type Orchestrator } from "./agents/orchestrator";
import { openRunStore } from "./agents/run-store";
import { startAi } from "./ai/bootstrap";
import { loadOrCreateToken } from "./auth";
import { createCodeService } from "./code/code-service";
import { removeDaemonInfo, writeDaemonInfo } from "./components/daemon-info";
import { startSandboxServer } from "./components/sandbox-server";
import { type ComponentsDeps, createComponentsService } from "./components/service";
import { type IntegrationFlags, NO_INTEGRATION_FLAGS, startIntegrations } from "./integrations/bootstrap";
import { createIntegrationHost } from "./integrations/host";
import { createRedactor, type Redactor } from "./integrations/redact";
import { startServer } from "./server";
import { call, createService } from "./service";
import { openStore } from "./store";

export type DaemonOptions = {
  home: string;
  port: number;
  sandboxPort: number;
  uiDir: string | null;
  dev: boolean;
  toolchain: Toolchain;
  user: string;
  notifications?: Session["notifications"];
  notify?: (notice: Notice) => void;
  claudeBin?: string | null;
  sampler?: () => HostLoad;
  integrations?: IntegrationFlags;
  redactor?: Redactor;
  agentEnv?: Record<string, string | undefined>;
  assistantTimeoutMs?: number;
} & Partial<
  Pick<ComponentsDeps, "build" | "validate" | "processCommand" | "net" | "installCli" | "cliStatus">
>;

export type Daemon = { url: string; port: number; sandboxPort: number; token: string; stop(): Promise<void> };

const VITE_ORIGIN = "http://localhost:5173";

type Closer = () => void | Promise<void>;
type Closers = { front: Closer[]; back: Closer[] };

async function closeAll(closers: Closer[]): Promise<void> {
  const failures: unknown[] = [];
  for (const close of closers.splice(0).reverse()) {
    try {
      await close();
    } catch (e) {
      failures.push(e);
    }
  }
  if (failures.length > 0) throw new AggregateError(failures, "daemon shutdown failed");
}

async function shutdown(closers: Closers): Promise<void> {
  try {
    await closeAll(closers.front);
  } finally {
    await closeAll(closers.back);
  }
}

async function assemble(opts: DaemonOptions, { front, back: closers }: Closers): Promise<Daemon> {
  const devOrigins = opts.dev ? [VITE_ORIGIN] : [];
  const store = openStore(opts.home);
  closers.push(() => store.close());
  const runs = openRunStore(opts.home);
  closers.push(() => runs.close());
  const token = loadOrCreateToken(opts.home);
  const service = createService(store, {
    user: opts.user,
    ...(opts.notifications && { notifications: opts.notifications }),
  });
  const redactor = opts.redactor ?? createRedactor();
  const integrations = startIntegrations(
    createIntegrationHost({
      user: opts.user,
      home: opts.home,
      store,
      service,
      notify: opts.notify ?? (() => {}),
    }),
    opts.integrations ?? NO_INTEGRATION_FLAGS,
    redactor,
  );
  closers.push(service.attachIntegrations(integrations));
  closers.push(() => integrations.stop());
  let agents: Orchestrator | null = null;
  let sandboxOrigin = "";
  const components = createComponentsService({
    home: opts.home,
    toolchain: opts.toolchain,
    db: store.db,
    docs: service.docs,
    sandboxOrigin: () => sandboxOrigin,
    runs: (projectId) => (agents ? ticketRuns(agents.state(), projectId) : []),
    ...(opts.build && { build: opts.build }),
    ...(opts.validate && { validate: opts.validate }),
    ...(opts.processCommand && { processCommand: opts.processCommand }),
    ...(opts.net && { net: opts.net }),
    integrations: () => integrations.hooks,
    ...(opts.installCli && { installCli: opts.installCli }),
    ...(opts.cliStatus && { cliStatus: opts.cliStatus }),
  });
  closers.push(service.attachComponents(components));
  closers.push(() => components.stop());
  await components.start();
  const code = createCodeService(service);
  closers.push(() => code.stop());
  const server = startServer({
    service,
    code,
    token,
    port: opts.port,
    uiDir: opts.uiDir,
    extraOrigins: devOrigins,
    hooks: {
      verify: (runId, runToken) => agents?.hooks.verify(runId, runToken) ?? false,
      receive: (runId, payload, toolInput) => agents?.hooks.receive(runId, payload, toolInput) ?? null,
    },
    assets: components.assets,
    sandboxOrigin: () => sandboxOrigin || null,
    redact: redactor.redact,
  });
  front.push(() => server.stop());
  const sandbox = startSandboxServer({
    port: opts.sandboxPort,
    uiPort: server.port,
    assets: components.assets,
    extraAncestors: devOrigins,
  });
  front.push(() => sandbox.stop());
  sandboxOrigin = sandbox.url;
  const orchestrator = createOrchestrator({
    home: opts.home,
    store: runs,
    data: service.agentData,
    claudeBin: opts.claudeBin ?? null,
    hook: defaultHookLauncher(),
    baseUrl: () => server.url,
    sampler: opts.sampler ?? createLoadSampler(),
    hostInfo: readHostInfo(),
    notify: opts.notify ?? (() => {}),
    ...(opts.agentEnv && { env: opts.agentEnv }),
  });
  closers.push(() => orchestrator.stop());
  agents = orchestrator;
  closers.push(service.attachAgents(orchestrator));
  const ai = await startAi({
    home: opts.home,
    toolchain: opts.toolchain,
    db: store.db,
    docs: service.docs,
    orchestrator,
    components,
    validate: opts.validate ?? null,
    claudeBin: opts.claudeBin ?? null,
    agentEnv: opts.agentEnv ?? process.env,
    address: `127.0.0.1:${server.port}`,
    listIntegrations: async () => call(service, { method: "listIntegrations" }),
    ...(opts.assistantTimeoutMs !== undefined && { assistantTimeoutMs: opts.assistantTimeoutMs }),
  });
  closers.push(service.attachAi(ai.port));
  closers.push(() => ai.stop());
  writeDaemonInfo(opts.home, { port: server.port, sandboxPort: sandbox.port, pid: process.pid });
  front.push(() => removeDaemonInfo(opts.home));
  return {
    url: server.url,
    port: server.port,
    sandboxPort: sandbox.port,
    token,
    stop: () => shutdown({ front, back: closers }),
  };
}

export async function startDaemon(opts: DaemonOptions): Promise<Daemon> {
  const closers: Closers = { front: [], back: [] };
  try {
    return await assemble(opts, closers);
  } catch (e) {
    await shutdown(closers).catch((failure: unknown) =>
      console.error("[kibo-daemon] cleanup failed", failure),
    );
    throw e;
  }
}
