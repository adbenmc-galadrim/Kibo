import { homedir } from "node:os";
import { backupsRpc } from "./backups/rpc";
import { declareRefRpc } from "./code/declare-ref";
import { startCollab } from "./collab/bootstrap";
import { removeDaemonInfo, writeDaemonInfo } from "./components/daemon-info";
import { migrateDomainScopes } from "./config/domain-scope-migration";
import { startProjectAdmin } from "./daemon-admin";
import { startAgents } from "./daemon-agents";
import { startDaemonComponents, startDaemonIntegrations, startDaemonSandbox } from "./daemon-components";
import { clockFromEnv, type DaemonOptions } from "./daemon-options";
import { type Closers, shutdown } from "./daemon-shutdown";
import { createLocalServices, openDaemonStores } from "./daemon-stores";
import { lateActivity, startDaemonTracking } from "./daemon-tracking";
import { startAppDiagnostics } from "./diagnostics/bootstrap";
import { createLogBuffer } from "./log-buffer";
import { startNotes } from "./notes/bootstrap";
import { createProjectSettings } from "./notes/settings";
import { startProjectAgent } from "./project-agent/bootstrap";
import { projectAgentSource } from "./project-agent/definition";
import { startWakeup } from "./project-agent/wakeup/bootstrap";
import { questionImageFiles } from "./questions/question-images-port";
import type { Orchestrator } from "./runs/orchestrator";
import { startServer } from "./server";
import { createService } from "./service";
import { ready } from "./service-ports";
import { openSessionStore } from "./sessions/session-store";
import { DaemonRunning, findRunningDaemon } from "./single-instance";
import { startCodeTracking } from "./tracking/bootstrap";
import { deliveryStepRpc } from "./tracking/delivery-step";

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
  let agents: Orchestrator | null = null;
  const activity = lateActivity();
  const questionImages = questionImageFiles(opts.home, (projectId) => notes.notesDir(projectId));
  const service = createService(store, {
    user: opts.user,
    ...(opts.notifications && { notifications: opts.notifications }),
    agents: opts.agentSource ?? projectAgentSource(),
    questionImages,
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
  const notes = await startNotes({ db: store.db, home: opts.home, docs: service.docs });
  closers.push(() => notes.stop());
  const components = startDaemonComponents(
    opts,
    service,
    {
      db: store.db,
      notes: notes.notes,
      sandboxOrigin: () => sandboxOrigin,
      runs: () => [],
      integrations: () => integrations.hooks,
      presence: (projectId) => collab.presence.peers(projectId),
      sharing: (projectId) => collab.syncInfo(projectId),
      projectEvents: tracking.projectEvents,
    },
    closers,
  );
  const wakeup = startWakeup({
    home: opts.home,
    docs: service.docs,
    agent: () => projectAgent.agent,
    answerGrace: opts.answerWakeGraceMs,
  });
  closers.push(wakeup.stop);
  closers.push(service.attachAnswerWake({ wake: wakeup.wakeOnAnswer }));
  const projectAgent = startProjectAgent({
    home: opts.home,
    service,
    notes: notes.notes,
    settings: createProjectSettings(store.db),
    orchestrator: () => ready(agents, "INTERNAL", "agents are not ready"),
    notify: opts.notify ?? (() => {}),
    events: tracking.sink,
  });
  closers.push(() => projectAgent.stop());
  wakeup.start();
  const admin = startProjectAdmin(store, service, { collab, agents: () => agents });
  const code = startCodeTracking(
    service,
    closers,
    opts.code,
    tracking.passes(() => projectAgent.agent),
  );
  const app = startAppDiagnostics({
    home: opts.home,
    userHome: opts.userHome ?? homedir(),
    startedAt,
    service,
    log: opts.logBuffer ?? createLogBuffer(),
    fixedNow: clock.fixedNow,
    today: clock.today,
    claudeBin: opts.claudeBin ?? null,
    env: opts.agentEnv ?? process.env,
    address: () => `127.0.0.1:${server.port}`,
    capacity: () => {
      const { host } = ready(agents, "INTERNAL", "agents are not ready").state();
      return { cores: host.cores, ramGb: host.ramGb, hostSlots: host.hostSlots };
    },
  });
  const server = startServer({
    service,
    code,
    token,
    sessions: openSessionStore(store.db),
    extensions: [
      backupsRpc(local.backups),
      app.rpc,
      ...tracking.rpc,
      declareRefRpc(service),
      deliveryStepRpc({
        docs: service.docs,
        runs: () => ready(agents, "INTERNAL", "agents are not ready").state().runs,
        now: Date.now,
      }),
      projectAgent.agent.rpc,
      projectAgent.plan.rpc,
    ],
    port: opts.port,
    uiDir: opts.uiDir,
    extraOrigins: devOrigins,
    hooks: {
      verify: (runId, token) => agents?.hooks.verify(runId, token) ?? false,
      receive: (runId, payload, toolInput) => agents?.hooks.receive(runId, payload, toolInput) ?? null,
    },
    agentMcp: projectAgent.agent.mcp,
    icons: service.icons,
    questionImages,
    sandboxOrigin: () => sandboxOrigin || null,
    redact: redactor.redact,
    handlers: [collab.handler, admin.handler],
  });
  front.push(() => server.stop());
  uiPort = server.port;
  const sandbox = startDaemonSandbox(
    {
      port: opts.sandboxPort,
      uiPort: server.port,
      extraAncestors: devOrigins,
      files: { open: (token) => components.files.open(token) },
      designs: { open: (token) => integrations.design.open(token) },
      embeds: { relay: (token) => integrations.relay(token) },
    },
    front,
  );
  sandboxOrigin = sandbox.url;
  await startAgents(
    {
      opts,
      runs,
      service,
      baseUrl: () => server.url,
      projectTurns: projectAgent.agent.turns,
      ready: (orchestrator) => {
        agents = orchestrator;
      },
      attachRuns: (source) => collab.attachRuns(source),
    },
    closers,
  );
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
