import { guidelineChain } from "@kibo/core/context";
import { canResume, resumableRuns } from "@kibo/core/run-resume";
import {
  defaultHostSlots,
  headRank,
  orderQueue,
  planAdmissions,
  rankForMove,
  tailRank,
} from "@kibo/core/scheduler";
import {
  type AgentProfile,
  DEFAULT_CPU_THRESHOLD,
  DEFAULT_RAM_THRESHOLD,
  type HostLoad,
  HostSettings,
  type HostView,
  isTerminal,
  KiboError,
  type RunView,
} from "@kibo/schema";
import { previewAssign } from "./assign-preview";
import type { HookSink } from "./hook-route";
import { noticeFor } from "./notifier";
import { guarded, holdsSlot, startOfDay } from "./orchestrator-support";
import type { Orchestrator, OrchestratorOptions, TaskSpec } from "./orchestrator-types";
import { createRunLauncher, type LiveRun } from "./run-launch";
import { openRunRegistry } from "./run-registry";
import type { NewRun } from "./run-store";
import { sameRunToken } from "./run-token";
import { reapOrphan } from "./runner";

export type {
  AgentDataPort,
  AssignInput,
  Orchestrator,
  OrchestratorOptions,
  TaskInput,
  TicketContext,
  ToolGuard,
} from "./orchestrator-types";

export function createOrchestrator(opts: OrchestratorOptions): Orchestrator {
  const now = opts.now ?? Date.now;
  const registry = openRunRegistry(opts.store, now);
  const live = new Map<string, LiveRun>();
  const tasks = new Map<string, TaskSpec>();
  const listeners = new Set<() => void>();
  const stateListeners = new Set<(run: RunView) => void>();
  let load: HostLoad = { cpu: 0, ram: 0 };
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

  const settings = (): HostSettings => ({
    hostSlots: defaultHostSlots(opts.hostInfo),
    cpuThreshold: DEFAULT_CPU_THRESHOLD,
    ramThreshold: DEFAULT_RAM_THRESHOLD,
    paused: false,
    ...opts.store.hostSettings(),
  });
  const profileOf = (id: string): AgentProfile => {
    const found = opts.data.profiles().find((p) => p.id === id);
    if (!found) throw new KiboError("NOT_FOUND", `profile ${id} not found`);
    return found;
  };
  const ticketProfileOf = (id: string): AgentProfile => {
    const found = profileOf(id);
    if (found.system) throw new KiboError("INVALID_INPUT", `profile ${found.name} is reserved to Kibo`);
    return found;
  };
  const plan = (runs: RunView[]) =>
    planAdmissions({ runs, profiles: opts.data.profiles(), settings: settings(), load });
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
    profileOf,
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
    if (current !== signature) {
      signature = current;
      emit();
    }
  }

  const hostView = (): HostView => ({
    ...settings(),
    autoSlots: defaultHostSlots(opts.hostInfo),
    slotsFixed: opts.store.hostSettings().hostSlots !== undefined,
    cores: opts.hostInfo.cores,
    ramGb: opts.hostInfo.ramGb,
    used: registry.all().filter(holdsSlot).length,
    cpu: Math.round(load.cpu),
    ram: Math.round(load.ram),
  });

  const hooks: HookSink = {
    verify(runId, token) {
      const entry = live.get(runId);
      return entry !== undefined && sameRunToken(token, entry.hash);
    },
    receive(runId, payload, toolInput) {
      registry.apply(runId, { type: "hook", payload });
      const guard = tasks.get(runId)?.guard;
      if (!guard || payload.event !== "PreToolUse") return null;
      try {
        return guard({ tool: payload.tool ?? "", input: toolInput ?? null });
      } catch (e) {
        console.error(`[kibo-daemon] guard of run ${runId} failed, denying`, e);
        return { decision: "deny", reason: "guard error" };
      }
    },
  };

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

  const resumeContext = (runs: RunView[]) => ({
    runs,
    alive: (id: string) => live.has(id),
    profileIds: new Set(opts.data.profiles().map((p) => p.id)),
  });

  const enqueue = (run: NewRun): RunView => registry.create(run, tailRank(registry.all()));

  return {
    assign(input) {
      const profile = ticketProfileOf(input.profileId);
      const { ticket } = opts.data.ticketContext(input.projectId, input.ticketId);
      if (ticket.key === null) throw new KiboError("INVALID_INPUT", "ticket has no key yet");
      opts.data.assertWritable(input.projectId);
      opts.data.assignTicket(input.projectId, ticket.id, profile.name);
      const view = enqueue({
        id: crypto.randomUUID(),
        projectId: input.projectId,
        ticketId: ticket.id,
        ticketKey: ticket.key,
        ticketTitle: ticket.title,
        profileId: profile.id,
        profileName: profile.name,
        sessionId: crypto.randomUUID(),
        brief: input.brief,
      });
      tick();
      return registry.get(view.id);
    },
    submit(task) {
      const profile = profileOf(task.profileId);
      const id = crypto.randomUUID();
      tasks.set(id, {
        cwd: task.cwd,
        extraArgs: task.extraArgs ?? [],
        env: task.env ?? {},
        resume: task.resumeSessionId !== undefined,
        guard: task.guard,
      });
      enqueue({
        id,
        projectId: task.projectId,
        ticketId: null,
        ticketKey: null,
        ticketTitle: task.title,
        profileId: profile.id,
        profileName: profile.name,
        sessionId: task.resumeSessionId ?? crypto.randomUUID(),
        brief: task.prompt,
      });
      tick();
      return registry.get(id);
    },
    preview(input) {
      const profile = ticketProfileOf(input.profileId);
      const { ticket } = opts.data.ticketContext(input.projectId, input.ticketId);
      const key = ticket.key;
      if (key === null) throw new KiboError("INVALID_INPUT", "ticket has no key yet");
      const guidelines = guidelineChain(opts.data.guidelines(input.projectId), {
        projectId: input.projectId,
        domainId: ticket.domainId,
        profileId: profile.id,
      }).length;
      const runs = registry.all();
      return previewAssign({
        runs,
        projectId: input.projectId,
        ticket: { ...ticket, key },
        profile,
        guidelines,
        at: now(),
        plan,
      });
    },
    answer(runId, text) {
      const target = registry.get(runId);
      if (isTerminal(target.state) && !canResume(target, resumeContext(registry.all()))) {
        throw new KiboError("INVALID_TRANSITION", `run ${runId} cannot be resumed`);
      }
      registry.apply(runId, { type: "answered", text, rank: headRank(registry.all()) });
      tick();
      return registry.get(runId);
    },
    cancel(runId) {
      registry.apply(runId, { type: "cancelled" });
      live.get(runId)?.proc.kill();
      tick();
      return registry.get(runId);
    },
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
      };
    },
    log: (runId) => registry.log(runId),
    activeRuns: (profileId) =>
      registry.all().filter((r) => r.profileId === profileId && !isTerminal(r.state)).length,
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
