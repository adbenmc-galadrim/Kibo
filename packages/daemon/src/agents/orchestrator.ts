import { canResume, resumableRuns } from "@kibo/core/run-resume";
import { headRank, orderQueue, planAdmissions, rankForMove, tailRank } from "@kibo/core/scheduler";
import { type Agent, type HostLoad, HostSettings, isTerminal, KiboError, type RunView } from "@kibo/schema";
import { createLocksWatch } from "../locks/locks-watch";
import { agentGuardOf } from "./agent-guard";
import { activeRunOf } from "./assign-preview";
import { assertLeaf, childrenProbe } from "./children-probe";
import { createHookSink } from "./hook-sink";
import { hostSettingsOf, hostViewOf } from "./host-view";
import { noticeFor } from "./notifier";
import { createAssigner } from "./orchestrator-assign";
import { guarded, knownAgent, startOfDay, ticketAgent } from "./orchestrator-support";
import type { Orchestrator, OrchestratorOptions, TaskSpec, ToolGuard } from "./orchestrator-types";
import { createProjectRun } from "./project-run";
import { cancelRun } from "./run-cancel";
import { createRunLauncher, type LiveRun } from "./run-launch";
import { openRunRegistry } from "./run-registry";
import type { NewRun } from "./run-store";
import { reapOrphan } from "./runner";

export type {
  AgentDataPort,
  AssignInput,
  DemoAgent,
  Orchestrator,
  OrchestratorOptions,
  ProjectTurnPort,
  TaskInput,
  TicketContext,
  ToolGuard,
} from "./orchestrator-types";

export function createOrchestrator(opts: OrchestratorOptions): Orchestrator {
  const now = opts.now ?? Date.now;
  const registry = openRunRegistry(opts.store, now);
  const live = new Map<string, LiveRun>();
  const tasks = new Map<string, TaskSpec>();
  const guards = new Map<string, ToolGuard>();
  const listeners = new Set<() => void>();
  const stateListeners = new Set<(run: RunView) => void>();
  let load: HostLoad = { cpu: 0, ram: 0 };
  const locks = createLocksWatch(opts.locks);
  let stopping = false;
  let signature = "";
  let emitTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    if (emitTimer || stopping) return;
    emitTimer = setTimeout(() => {
      emitTimer = null;
      for (const listener of listeners) guarded("change listener", listener);
    }, 50);
  };
  registry.onChange((run, previous) => {
    const notice = previous ? noticeFor(previous, run) : null;
    if (notice) guarded("notification", () => opts.notify(notice));
    if (previous !== run.state) {
      for (const listener of stateListeners) guarded("run state listener", () => listener(run));
    }
    emit();
  });

  const settings = () => hostSettingsOf(opts.store, opts.hostInfo);
  const agentOf = (ref: string): Agent => knownAgent(opts.data, ref);
  const ticketAgentOf = (ref: string, projectId: string): Agent => ticketAgent(opts.data, ref, projectId);
  const schedulerAgents = () =>
    opts.data.agents(null).map((a) => ({ ref: a.ref, name: a.name, maxParallel: a.settings.maxParallel }));
  const plan = (runs: RunView[]) =>
    planAdmissions({ runs, agents: schedulerAgents(), settings: settings(), load });
  const sample = () => {
    try {
      load = opts.sampler();
    } catch (e) {
      console.error("[kibo-daemon] host load sampling failed", e);
    }
  };
  const launchRun = createRunLauncher({
    opts,
    registry,
    tasks,
    live,
    agentOf,
    guards,
    stopping: () => stopping,
  });

  function tick(): void {
    if (stopping) return;
    const next = plan(registry.all());
    for (const admission of next.admit) {
      registry.apply(admission.runId, { type: "admitted", lane: admission.lane });
      launchRun(admission.runId)
        .catch((e) => console.error(`[kibo-daemon] run ${admission.runId}`, e))
        .finally(() => guarded("queue pass", tick));
    }
    const current = JSON.stringify([next.waiting, Math.round(load.cpu), Math.round(load.ram)]);
    const locksChanged = locks.refresh();
    if (current !== signature || locksChanged) {
      signature = current;
      emit();
    }
  }

  const hostView = () => hostViewOf(opts.store, opts.hostInfo, registry.all(), load);
  const hooks = createHookSink({
    live,
    tasks,
    registry,
    agentGuard: (run) => guards.get(run.id) ?? agentGuardOf(opts.data.agentOf(run.profileId)),
  });

  for (const run of registry.interrupted()) {
    const spawned = registry
      .log(run.id)
      .flatMap((entry) => (entry.event.type === "spawned" ? [entry.event.pid] : []))
      .at(-1);
    if (spawned !== undefined) guarded(`reaping run ${run.id}`, () => reapOrphan(spawned, run.sessionId));
  }
  sample();
  tick();
  const timer = setInterval(() => {
    sample();
    guarded("queue pass", tick);
  }, opts.tickMs ?? 2000);
  timer.unref();

  const resumeContext = (runs: RunView[]) => {
    const children = childrenProbe(opts.data);
    return {
      runs,
      alive: (id: string) => live.has(id),
      profileIds: new Set(opts.data.agents(null).map((a) => a.ref)),
      hasChildren: (run: RunView) => children(run) > 0,
    };
  };

  const enqueue = (run: NewRun): RunView => registry.create(run, tailRank(registry.all()));

  const { assign, submit, preview } = createAssigner({
    opts,
    registry,
    tasks,
    tick,
    agentOf,
    ticketAgentOf,
    plan,
    now,
    enqueue,
  });

  return {
    assign,
    submit,
    startProjectRun(input) {
      const id = createProjectRun(
        { registry, agentOf, assertWritable: opts.data.assertWritable, projectKey: opts.data.projectKey },
        input,
      );
      tick();
      return registry.get(id);
    },
    preview,
    answer(runId, text) {
      const target = registry.get(runId);
      if (isTerminal(target.state)) assertLeaf(childrenProbe(opts.data)(target));
      if (isTerminal(target.state) && !canResume(target, resumeContext(registry.all()))) {
        throw new KiboError("INVALID_TRANSITION", `run ${runId} cannot be resumed`);
      }
      if (isTerminal(target.state) && target.ticketId && activeRunOf(registry.all(), target.ticketId))
        throw new KiboError("CONFLICT", `ticket ${target.ticketKey} already has an active run`);
      registry.apply(runId, { type: "answered", text, rank: headRank(registry.all()) });
      tick();
      return registry.get(runId);
    },
    cancel: (runId) =>
      cancelRun({ registry, live, tick, onEndedWithoutTurn: opts.onEndedWithoutTurn }, runId),
    move(runId, index) {
      registry.apply(runId, { type: "reranked", rank: rankForMove(registry.all(), runId, index) });
      tick();
    },
    setPriority(runId, priority) {
      registry.apply(runId, { type: "prioritized", priority });
      if (priority) registry.apply(runId, { type: "reranked", rank: headRank(registry.all()) });
      tick();
    },
    setHost(patch) {
      const parsed = HostSettings.partial().safeParse(patch);
      if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
      opts.store.saveHostSettings(parsed.data);
      tick();
      emit();
      return hostView();
    },
    state() {
      const runs = registry.all();
      const reasons = new Map(plan(runs).waiting.map((w) => [w.runId, w.reason]));
      return {
        runs,
        queue: orderQueue(runs).map((r, i) => ({
          runId: r.id,
          position: i + 1,
          reason: reasons.get(r.id) ?? null,
        })),
        host: hostView(),
        tokensToday: registry.tokensSince(startOfDay(now())),
        resumable: resumableRuns(resumeContext(runs)),
        questions: [],
        projectAgents: [],
        progress: [],
        signals: [],
        locks: locks.current(),
      };
    },
    log: (runId) => registry.log(runId),
    activeRuns: (ref) => registry.all().filter((r) => r.profileId === ref && !isTerminal(r.state)).length,
    hooks,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onRunState(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    async stop() {
      stopping = true;
      clearInterval(timer);
      if (emitTimer) clearTimeout(emitTimer);
      emitTimer = null;
      const procs = [...live.values()].map((entry) => entry.proc);
      for (const proc of procs) guarded(`stopping process ${proc.pid}`, () => proc.kill());
      await Promise.allSettled(procs.map((proc) => proc.exited));
    },
  };
}
