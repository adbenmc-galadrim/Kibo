import { osSandbox, type Toolchain } from "@kibo/devkit";
import { type HostLoad, KiboError, type Session, ticketRuns } from "@kibo/schema";
import { defaultHookLauncher } from "./agents/hook-launcher";
import { createLoadSampler, readHostInfo } from "./agents/host-load";
import type { Notice } from "./agents/notifier";
import { createOrchestrator, type Orchestrator } from "./agents/orchestrator";
import { openRunStore } from "./agents/run-store";
import { startAi } from "./ai/bootstrap";
import { loadOrCreateToken } from "./auth";
import { createCodeService } from "./code/code-service";
import { startCollab } from "./collab/bootstrap";
import { removeDaemonInfo, writeDaemonInfo } from "./components/daemon-info";
import { startSandboxServer } from "./components/sandbox-server";
import { type ComponentsDeps, createComponentsService } from "./components/service";
import { componentTrustGuard } from "./components/trust-guard";
import { type IntegrationFlags, NO_INTEGRATION_FLAGS, startIntegrations } from "./integrations/bootstrap";
import { createIntegrationHost } from "./integrations/host";
import { createRedactor, type Redactor } from "./integrations/redact";
import { startMarket } from "./market/bootstrap";
import { listInterfaces } from "./remote/interfaces";
import { PairingCodes } from "./remote/pairing-codes";
import { createRemoteAccess, type RemoteAccess } from "./remote/remote-access";
import { remoteRpc } from "./remote/rpc";
import { sandboxRpc } from "./sandbox/rpc";
import { createSandboxService } from "./sandbox/sandbox-service";
import { startServer } from "./server";
import { call, createService } from "./service";
import { openSessionStore } from "./sessions/session-store";
import { openLocalSettings } from "./settings";
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
  marketAllowLoopback?: boolean;
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
  const sandboxService = createSandboxService({
    sandbox: osSandbox(),
    settings: openLocalSettings(store),
    emit: (message) => service.docs.emit(message),
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
  const collab = await startCollab({ store, service, user: opts.user, secrets: integrations.secrets });
  closers.push(() => collab.stop());
  let agents: Orchestrator | null = null;
  let sandboxOrigin = "";
  const components = createComponentsService({
    home: opts.home,
    toolchain: opts.toolchain,
    db: store.db,
    docs: service.docs,
    commands: service.commands,
    sandboxOrigin: () => sandboxOrigin,
    runs: (projectId) => (agents ? ticketRuns(agents.state(), projectId) : []),
    ...(opts.build && { build: opts.build }),
    ...(opts.validate && { validate: opts.validate }),
    ...(opts.processCommand && { processCommand: opts.processCommand }),
    allowUnsandboxed: () => sandboxService.allowUnsandboxed(),
    ...(opts.net && { net: opts.net }),
    integrations: () => integrations.hooks,
    ...(opts.installCli && { installCli: opts.installCli }),
    ...(opts.cliStatus && { cliStatus: opts.cliStatus }),
  });
  closers.push(service.attachComponents(components));
  closers.push(() => components.stop());
  await components.start();
  const market = await startMarket({
    home: opts.home,
    toolchain: opts.toolchain,
    ...(opts.validate && { validate: opts.validate }),
    db: store.db,
    docs: service.docs,
    components,
    secrets: integrations.secrets,
    notify: opts.notify ?? (() => {}),
    allowLoopbackHttp: opts.marketAllowLoopback ?? false,
  });
  closers.push(() => market.stop());
  const code = createCodeService(service);
  closers.push(() => code.stop());
  const pairingCodes = new PairingCodes(Date.now);
  let remote: RemoteAccess | null = null;
  const remoteAccess = () => {
    if (!remote) throw new KiboError("INTERNAL", "remote access is not initialised");
    return remote;
  };
  const server = startServer({
    service,
    code,
    token,
    sessions: openSessionStore(store.db),
    pairingCodes,
    extensions: [remoteRpc(remoteAccess, pairingCodes), sandboxRpc(sandboxService)],
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
    handlers: [componentTrustGuard, market.handler, collab.handler],
  });
  front.push(() => server.stop());
  const started = createRemoteAccess({
    home: opts.home,
    settings: openLocalSettings(store),
    secrets: integrations.secrets,
    interfaces: () => listInterfaces(),
    listen: (input) => server.listenRemote(input),
    log: (message) => console.warn(`[kibo-daemon] ${message}`),
  });
  remote = started;
  front.push(() => started.stop());
  await started.resume();
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
