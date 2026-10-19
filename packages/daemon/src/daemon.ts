import { homedir } from "node:os";
import { ticketRuns } from "@kibo/schema";
import { lateAgentSource } from "./agents/agent-source";
import { allowsTicketExecution } from "./agents/execution-removed";
import type { Orchestrator } from "./agents/orchestrator";
import { withSignalCounts } from "./agents-rpc";
import type { DraftAssets } from "./ai/draft-preview";
import { backupsRpc } from "./backups/rpc";
import { declareRefRpc } from "./code/declare-ref";
import { startCollab } from "./collab/bootstrap";
import { removeDaemonInfo, writeDaemonInfo } from "./components/daemon-info";
import { componentTrustGuard } from "./components/trust-guard";
import { migrateDomainScopes } from "./config/domain-scope-migration";
import { startProjectAdmin } from "./daemon-admin";
import { startAgents } from "./daemon-agents";
import { startDaemonComponents, startDaemonIntegrations } from "./daemon-components";
import { startDaemonFiles } from "./daemon-files";
import { startDaemonSandbox, startRemote } from "./daemon-network";
import { clockFromEnv, type DaemonOptions } from "./daemon-options";
import { type Closers, shutdown } from "./daemon-shutdown";
import { createLocalServices, openDaemonStores } from "./daemon-stores";
import { lateActivity, startDaemonTracking } from "./daemon-tracking";
import { startDelivery } from "./delivery/bootstrap";
import { startTutorial } from "./demo/bootstrap";
import { startAppDiagnostics } from "./diagnostics/bootstrap";
import { createLogBuffer } from "./log-buffer";
import { startMarket } from "./market/bootstrap";
import { createProjectSettings } from "./notes/settings";
import { startOverlaps } from "./overlaps/bootstrap";
import { startProjectAgent } from "./project-agent/bootstrap";
import { agentQuestionHooks } from "./questions/agent-hooks";
import { PairingCodes } from "./remote/pairing-codes";
import type { RemoteAccess } from "./remote/remote-access";
import { remoteRpc } from "./remote/rpc";
import { sandboxRpc } from "./sandbox/rpc";
import { startServer } from "./server";
import { createService } from "./service";
import { ready } from "./service-ports";
import { openSessionStore } from "./sessions/session-store";
import { openLocalSettings } from "./settings";
import { startSignals } from "./signals/bootstrap";
import { DaemonRunning, findRunningDaemon } from "./single-instance";
import { startCodeTracking } from "./tracking/bootstrap";

export type { DaemonOptions } from "./daemon-options";

export type Daemon = { url: string; port: number; sandboxPort: number; token: string; stop(): Promise<void> };

const VITE_ORIGIN = "http://localhost:5173";

async function assemble(opts: DaemonOptions, { front, back: closers }: Closers): Promise<Daemon> {
  const running = await findRunningDaemon(opts.home, opts.probe);
  if (running) throw new DaemonRunning(opts.home, running);
  const devOrigins = opts.dev ? [VITE_ORIGIN] : [];
  const { store, runs, token, redactor } = openDaemonStores(opts, closers);
  const startedAt = Date.now();
  const clock = opts.clock ?? clockFromEnv(process.env, console.error);
  const late = lateAgentSource();
  let agents: Orchestrator | null = null;
  const activity = lateActivity();
  const delivery = startDelivery({
    home: opts.home,
    userHome: opts.userHome ?? homedir(),
    env: opts.agentEnv ?? process.env,
    notify: opts.notify ?? (() => {}),
    service: () => service,
    notesDir: (projectId) => components.notesDir(projectId),
    moments: () => visibility.trace,
    agentSettings: () => agentFiles,
    orchestrator: () => agents,
  });
  closers.push(delivery.close);
  const service = createService(store, {
    user: opts.user,
    ...(opts.notifications && { notifications: opts.notifications }),
    agents: opts.agentSource ?? late.source,
    questionImages: delivery.questionImages,
    clock,
    activity,
  });
  const local = createLocalServices(opts, { store, runs }, (message) => service.docs.emit(message));
  let sandboxOrigin = "";
  let uiPort: number | null = null;
  const integrations = startDaemonIntegrations(
    opts,
    { store, service, sandboxOrigin: () => sandboxOrigin || null, uiPort: () => uiPort },
    { devOrigins, redactor },
    closers,
  );
  const collab = await startCollab({ store, service, user: opts.user, secrets: integrations.secrets });
  closers.push(() => collab.stop());
  await migrateDomainScopes({ docs: service.docs, log: console.error, now: Date.now });
  const tracking = startDaemonTracking({ store, service, clock, activity }, closers);
  const { visibility, extensions, agentFiles } = await startDaemonFiles(
    opts,
    { db: store.db, runs, service, late, agents: () => agents },
    closers,
  );
  const components = await startDaemonComponents(
    opts,
    service,
    {
      db: store.db,
      sandboxOrigin: () => sandboxOrigin,
      runs: (projectId) => (agents ? ticketRuns(agents.state(), projectId) : []),
      allowUnsandboxed: () => local.sandbox.allowUnsandboxed(),
      integrations: () => integrations.hooks,
      presence: (projectId) => collab.presence.peers(projectId),
      sharing: (projectId) => collab.syncInfo(projectId),
      peekRun: visibility.peek,
      delivery: delivery.components,
      appSettings: tracking.appSettings,
      projectEvents: tracking.projectEvents,
    },
    closers,
  );
  const signals = startSignals({
    home: opts.home,
    docs: service.docs,
    trace: visibility.trace,
    notify: opts.notify ?? (() => {}),
    agent: () => projectAgent.agent,
    answerGrace: opts.answerWakeGraceMs,
  });
  closers.push(signals.stop);
  closers.push(service.attachAnswerWake({ wake: signals.wakeOnAnswer }));
  const projectAgent = startProjectAgent({
    home: opts.home,
    service,
    notes: components.notes,
    settings: createProjectSettings(store.db),
    orchestrator: () => ready(agents, "INTERNAL", "agents are not ready"),
    notify: opts.notify ?? (() => {}),
    signals: signals.service,
    agentExecution: () =>
      allowsTicketExecution(opts.ticketExecution) ? "shown" : tracking.appSettings.get().agentExecution,
    events: tracking.sink,
  });
  closers.push(() => projectAgent.stop());
  signals.start();
  const overlaps = startOverlaps({
    home: opts.home,
    docs: service.docs,
    settings: createProjectSettings(store.db),
    trace: visibility.trace,
    runs: () => (agents ? agents.state().runs : []),
    viewer: opts.user,
  });
  closers.push(overlaps.stop);
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
  const tutorial = startTutorial({
    home: opts.home,
    service,
    settings: openLocalSettings(store),
    projectSettings: createProjectSettings(store.db),
    notesDir: (projectId) => components.notesDir(projectId),
    log: (message, ...error) => console.error(`[kibo-daemon] ${message}`, ...error),
  });
  closers.push(() => tutorial.stop());
  const admin = startProjectAdmin(store, service, { collab, tutorial, agents: () => agents });
  const code = startCodeTracking(
    service,
    closers,
    opts.code,
    tracking.passes(() => projectAgent.agent),
  );
  const pairingCodes = new PairingCodes(Date.now);
  let remote: RemoteAccess | null = null;
  const remoteAccess = () => ready(remote, "INTERNAL", "remote access is not initialised");
  const app = startAppDiagnostics({
    home: opts.home,
    userHome: opts.userHome ?? homedir(),
    startedAt,
    service,
    components,
    log: opts.logBuffer ?? createLogBuffer(),
    fixedNow: clock.fixedNow,
    today: clock.today,
  });
  const server = startServer({
    service,
    code,
    token,
    sessions: openSessionStore(store.db),
    pairingCodes,
    extensions: [
      remoteRpc(remoteAccess, pairingCodes),
      sandboxRpc(local.sandbox),
      backupsRpc(local.backups),
      app.rpc,
      ...tracking.rpc,
      declareRefRpc(service),
      tutorial.rpc,
      projectAgent.agent.rpc,
      visibility.rpc,
      signals.rpc,
      overlaps.rpc,
      ...extensions,
      ...delivery.rpc,
    ],
    port: opts.port,
    uiDir: opts.uiDir,
    extraOrigins: devOrigins,
    hooks: visibility.hooks(
      overlaps.hooks(agentQuestionHooks(() => agents, service.agentData, opts.notify ?? (() => {}))),
    ),
    agentMcp: visibility.mcp(projectAgent.agent.mcp, signals.service, overlaps.peek),
    assets: components.assets,
    icons: service.icons,
    questionImages: delivery.questionImages,
    sandboxOrigin: () => sandboxOrigin || null,
    redact: redactor.redact,
    handlers: [
      tutorial.guard,
      componentTrustGuard,
      market.handler,
      collab.handler,
      admin.handler,
      ...delivery.handlers,
    ],
  });
  front.push(() => server.stop());
  uiPort = server.port;
  remote = await startRemote(
    { home: opts.home, settings: openLocalSettings(store), secrets: integrations.secrets },
    server,
    front,
  );
  let draftAssets: DraftAssets | null = null;
  const sandbox = startDaemonSandbox(
    {
      port: opts.sandboxPort,
      uiPort: server.port,
      assets: components.assets,
      extraAncestors: devOrigins,
      files: { open: (token) => components.files.open(token) },
      designs: { open: (token) => integrations.design.open(token) },
      embeds: { relay: (token) => integrations.relay(token) },
    },
    () => draftAssets,
    front,
  );
  sandboxOrigin = sandbox.url;
  const { ai } = await startAgents(
    {
      opts,
      runs,
      service,
      baseUrl: () => server.url,
      port: server.port,
      projectTurns: projectAgent.agent.turns,
      lifecycle: delivery.lifecycle({
        ...overlaps.lifecycle(visibility.lifecycle),
        turnPrefix: overlaps.prefixer,
      }),
      locks: delivery.locks,
      ready: (orchestrator) => {
        agents = orchestrator;
      },
      attachRuns: (source) => collab.attachRuns(source),
      agentsPort: (orchestrator) =>
        delivery.agents(overlaps.agents(withSignalCounts(visibility.agents(orchestrator), signals.service))),
      ai: { db: store.db, components, appInfo: app.appInfo },
    },
    closers,
  );
  draftAssets = ai.draftAssets;
  closers.push(local.scheduleBackups());
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
