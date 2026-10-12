import { readProject } from "@kibo/core";
import {
  type AgentsState,
  isTerminal,
  KiboError,
  type MomentData,
  type ParallelWork,
  type RunView,
} from "@kibo/schema";
import type { HookSink } from "../agents/hook-route";
import type { ReminderDeps } from "../agents/reminders";
import { type GitRunner, runGit } from "../agents/workspace-prep";
import type { ScheduleTimers } from "../backups/schedule";
import type { Docs } from "../docs";
import type { TraceService } from "../moments/trace-service";
import type { ProjectSettings } from "../notes/settings";
import type { RpcExtension } from "../rpc-extensions";
import { createAutoLinker } from "./auto-link";
import { overlapAggregates, withOverlapCounts } from "./counts";
import { openDeliveredOverlaps, storeAlerts, withOverlapAlerts } from "./delivery";
import { createOverlapDetector } from "./detector";
import { sha256Hex } from "./hash";
import { createPeek } from "./peek";
import { createImportProbes } from "./probes";
import { createOverlapReader } from "./read";
import { overlapRpc } from "./rpc";
import { createRunPorts, screenFor } from "./run-ports";
import { duplicationSettings } from "./settings";
import { createSpaces } from "./spaces";
import { openOverlapStore } from "./store";
import { createSweepScheduler } from "./sweep";
import { createTurnPrefixer, type TurnPrefixer } from "./turn-prefix";
import { createWorkView } from "./work-view";
import { createWorkspaceIndexer, nodeIndexFs } from "./workspace-index";
import { withOverlapWrites } from "./writes";

export type OverlapsDocs = Pick<Docs, "run" | "project" | "projectIds" | "emit" | "assertWritable">;

export type OverlapsInput = {
  home: string;
  docs: OverlapsDocs;
  settings: Pick<ProjectSettings, "get">;
  trace: Pick<TraceService, "trace" | "note">;
  runs(): RunView[];
  viewer: string;
  git?: GitRunner;
  timers?: ScheduleTimers;
  now?: () => number;
  log?: (line: string) => void;
};

type Lifecycle = { onSpawned(run: RunView): Promise<void>; onTurnEnd(run: RunView): Promise<void> };

export type Overlaps = {
  rpc: RpcExtension;
  hooks(sink: HookSink): HookSink;
  reminders: Required<Pick<ReminderDeps, "openDeliveredOverlaps">>;
  peek: { call(run: RunView, input: unknown): Promise<string> };
  prefixer: TurnPrefixer;
  lifecycle(base: Lifecycle): Lifecycle;
  agents<P extends { state(): AgentsState }>(port: P): P;
  stop(): Promise<void>;
};

const defaultLog = (line: string) => console.error(`[kibo-daemon] ${line}`);

export function startOverlaps(input: OverlapsInput): Overlaps {
  const now = input.now ?? Date.now;
  const log = input.log ?? defaultLog;
  const git = input.git ?? runGit;
  const { docs } = input;
  const store = openOverlapStore(input.home);
  const settings = duplicationSettings(input.settings);
  const emit = () => docs.emit({ topic: "agents" });
  const indexer = createWorkspaceIndexer({ git, fs: nodeIndexFs, now, hash: sha256Hex, log });
  const ports = createRunPorts({
    docs,
    trace: input.trace,
    store,
    indexer,
    runs: input.runs,
    settings,
    git,
    now,
    log,
  });
  const runName = (runId: string) => ports.run(runId)?.label ?? runId;
  const ticketKey = (runId: string) => ports.run(runId)?.ticketKey ?? runId;
  const moment = (runId: string, data: MomentData) => {
    try {
      input.trace.note(runId, data);
    } catch (e) {
      log(`overlaps: moment ${data.kind} of run ${runId} not written: ${String(e)}`);
    }
  };
  const spaces = createSpaces({ runs: input.runs, workspaceOf: ports.workspaceOf, now });
  const autoLinker = createAutoLinker({
    store,
    docs,
    snapshot: (projectId) => readProject(docs.project(projectId)),
    run: ports.run,
    probes: createImportProbes().probe,
    moment,
    now,
  });
  const detector = createOverlapDetector({
    store,
    indexer,
    workspaces: spaces.workspaces,
    gone: spaces.gone,
    projectOf: (runId) => ports.run(runId)?.projectId ?? null,
    settings,
    autoLinker,
    hash: sha256Hex,
    runName,
    moment,
    emit,
    now,
    log,
  });
  const openProjects = () => store.list({ state: "open" }).map((o) => o.projectId);
  const scheduler = createSweepScheduler({
    detector,
    projects: () => [...new Set([...spaces.projects(), ...openProjects()])],
    ...(input.timers && { timers: input.timers }),
    now,
    log,
  });
  const screen = screenFor(settings);
  const workView = createWorkView(ports);
  const peek = createPeek({ ...ports, screen, git, fs: nodeIndexFs });
  const prefixer = createTurnPrefixer({ parallelWork: workView.parallelWork, hash: sha256Hex, now });
  async function parallelWork(runId: string): Promise<ParallelWork> {
    const run = ports.run(runId);
    if (!run) throw new KiboError("NOT_FOUND", `run ${runId} not found`);
    return workView.parallelWork(run);
  }
  const rpc = overlapRpc({
    store,
    read: createOverlapReader({ store, runName, screen, fs: nodeIndexFs }),
    parallelWork,
    linker: autoLinker,
    data: { viewer: () => input.viewer, assertWritable: (projectId) => docs.assertWritable(projectId) },
    emit,
    now,
  });
  scheduler.start();
  return {
    rpc,
    hooks: (sink) =>
      withOverlapAlerts(withOverlapWrites(sink, { onWrite: detector.onWrite, log }), {
        ...storeAlerts(store, { runName, ticketKey }),
        now,
        log,
      }),
    reminders: { openDeliveredOverlaps: openDeliveredOverlaps(store, ticketKey) },
    peek,
    prefixer,
    lifecycle: (base) => ({
      async onSpawned(run) {
        peek.resetQuota(run.id);
        await base.onSpawned(run);
        if (run.projectId === null || !settings(run.projectId).enabled) return;
        scheduler.onSpawned(run, (await spaces.workspaces(run.projectId)).length);
      },
      async onTurnEnd(run) {
        try {
          await base.onTurnEnd(run);
        } finally {
          scheduler.onTurnEnd(run);
          if (isTerminal(run.state)) {
            detector.forget(run.id);
            prefixer.forget(run.id);
          }
        }
      },
    }),
    agents: (port) => withOverlapCounts(port, () => overlapAggregates(store)),
    async stop() {
      await scheduler.stop();
      store.close();
    },
  };
}
