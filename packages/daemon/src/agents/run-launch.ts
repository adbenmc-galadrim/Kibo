import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { headRank } from "@kibo/core/scheduler";
import {
  type Agent,
  DEMO_AGENT_REF,
  isProjectRun,
  isTerminal,
  mainSessionOf,
  RunEvent,
  type RunView,
  type SetupStep,
} from "@kibo/schema";
import { withSection } from "../overlaps/turn-prefix";
import { addDirsOf, realpathOrNull } from "./add-dirs";
import { NO_CLI_FALLBACKS } from "./cli-flags";
import { ticketLaunch } from "./mcp-launch";
import type { OrchestratorOptions, TaskSpec, ToolGuard } from "./orchestrator-types";
import { projectLaunch } from "./project-run";
import { notifyLifecycle } from "./run-lifecycle";
import { createTurnPreparer } from "./run-prepare";
import type { RunRegistry } from "./run-registry";
import { newRunToken } from "./run-token";
import { createRunTurns } from "./run-turns";
import {
  type CliCaps,
  cleanEnv,
  launch,
  type ProcessOutcome,
  permissionFlag,
  type RunProcess,
  readCliCaps,
  resolveClaudeBin,
} from "./runner";
import { decideProjectSession, decideSession, type SessionDecision } from "./session-decision";
import { transcriptTokensAt } from "./transcript";

export type LiveRun = { hash: string; proc: RunProcess };
export type LaunchDeps = {
  opts: OrchestratorOptions;
  registry: RunRegistry;
  tasks: Map<string, TaskSpec>;
  live: Map<string, LiveRun>;
  agentOf: (ref: string) => Agent;
  guards: Map<string, ToolGuard>;
  stopping: () => boolean;
};

const LOST_TASK = "INTERRUPTED: the task was lost when the daemon restarted";
const EXIT_STATES = new Set(["starting", "running", "done", "failed", "cancelled"]);
const firstPrompt = (brief: string, pending: string | null) =>
  pending === null ? brief : `${brief}\n\n${pending}`;
const titled = (title: string | null, prompt: string) => (title === null ? prompt : `${title}\n\n${prompt}`);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const transcriptExists = (path: string | null) => path !== null && existsSync(path);

export function createRunLauncher(deps: LaunchDeps): (runId: string) => Promise<void> {
  const { opts, registry, tasks, live } = deps;
  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now;
  const mint = opts.newToken ?? (() => newRunToken());
  const caps = new Map<string, Promise<CliCaps>>();

  const capsOf = (claudeBin: string): Promise<CliCaps> => {
    const known = caps.get(claudeBin);
    if (known) return known;
    const read = readCliCaps(claudeBin, cleanEnv(env));
    caps.set(claudeBin, read);
    read.then(undefined, () => caps.delete(claudeBin));
    return read;
  };

  const turns = createRunTurns({
    opts,
    preparer: createTurnPreparer({
      data: opts.data,
      fallbacks: { ...NO_CLI_FALLBACKS, ...opts.cliFallbacks },
    }),
    journalSetup(runId: string, step: SetupStep): void {
      if (registry.get(runId).state === "starting") registry.apply(runId, { type: "setup", ...step });
    },
  });

  async function laterSection(run: RunView, isTask: boolean): Promise<string | null> {
    if (isTask || run.turns === 0 || opts.turnPrefix === undefined) return null;
    return opts.turnPrefix.changedSection(run);
  }

  function recordExit(runId: string, outcome: ProcessOutcome, task: TaskSpec | undefined): RunView | null {
    const before = registry.get(runId);
    if (!EXIT_STATES.has(before.state)) {
      console.error(`[kibo-daemon] run ${runId} exited while ${before.state}, exit not recorded`);
      return null;
    }
    const result = outcome.result;
    const exited = RunEvent.parse({
      type: "exited",
      code: outcome.code,
      isError: result?.isError ?? outcome.code !== 0,
      result: result?.result ?? (outcome.stderrTail.trim().slice(-500) || null),
      tokens: result ? result.tokens : Math.max(0, transcriptTokensAt(before.transcriptPath) - before.tokens),
      costUsd: result?.costUsd ?? 0,
      denied: result?.denied ?? [],
      ...(task && result ? { output: result.raw } : {}),
    });
    return registry.apply(runId, exited);
  }

  function chooseSession(current: RunView, ticketId: string, cwd: string): SessionDecision {
    const { resumedFrom } = current;
    const previous = resumedFrom ? registry.get(resumedFrom) : mainSessionOf(registry.all(), ticketId);
    const decision = decideSession({
      run: current,
      previous,
      cwd,
      transcriptExists,
      newId: () => crypto.randomUUID(),
    });
    return journalSession(current, decision);
  }

  function journalSession(current: RunView, decision: SessionDecision): SessionDecision {
    registry.apply(
      current.id,
      decision.resume
        ? { type: "session", mode: "resumed", from: decision.from }
        : { type: "session", mode: "fresh", reason: decision.reason },
    );
    return decision;
  }

  function markAnswersDelivered(run: RunView, answers: string[]): void {
    if (!run.projectId || !run.ticketId || answers.length === 0) return;
    try {
      opts.data.markAnswersDelivered(run.projectId, run.ticketId, answers, run.id);
    } catch (e) {
      console.error(`[kibo-daemon] delivering answers to run ${run.id} failed`, e);
    }
  }

  function startRules(runId: string, projectId: string, ticketId: string): void {
    try {
      opts.data.runStarted(projectId, ticketId);
    } catch (e) {
      console.error(`[kibo-daemon] start rules of run ${runId} failed`, e);
    }
  }

  function endedWithoutTurn(view: RunView): void {
    if (isTerminal(view.state)) notifyLifecycle("no turn end hook", opts.onEndedWithoutTurn, view);
  }

  async function run(runId: string): Promise<void> {
    const initial = registry.get(runId);
    const project = isProjectRun(initial);
    const task = initial.ticketId === null && !project ? tasks.get(runId) : undefined;
    const runDir = join(opts.home, "runs", runId);
    try {
      if (initial.ticketId === null && !project && !task) {
        registry.apply(runId, { type: "failed", error: LOST_TASK });
        return;
      }
      const resume = initial.turns > 0 || (task?.resume ?? false);
      const agent = deps.agentOf(initial.profileId);
      const prepared = project
        ? await turns.project(initial, runDir)
        : task
          ? turns.task(initial, task, runDir)
          : await turns.ticket(initial, agent, runDir);
      const { turn } = prepared;
      const demo = agent.ref === DEMO_AGENT_REF;
      const userHome = opts.userHome ?? homedir();
      const claudeBin = demo ? opts.demoAgent.bin : resolveClaudeBin(opts.claudeBin, env, userHome);
      const addDirs = addDirsOf(agent.settings, prepared.delivery, {
        home: userHome,
        realpath: realpathOrNull,
        log: (line) => console.error(`[kibo-daemon] run ${runId}: ${line}`),
      });
      const flag = permissionFlag(agent.settings.permissionMode, await capsOf(claudeBin));
      const section = project ? null : await laterSection(initial, task !== undefined);
      const current = registry.get(runId);
      if (deps.stopping()) return;
      if (current.state !== "starting") return endedWithoutTurn(current);
      const cwd = realpathSync(prepared.cwd);
      const ticketId = task ? null : current.ticketId;
      const firstTicketTurn = ticketId !== null && current.turns === 0;
      const session = project
        ? journalSession(
            current,
            decideProjectSession(current, transcriptExists, () => crypto.randomUUID()),
          )
        : firstTicketTurn
          ? chooseSession(current, ticketId, cwd)
          : { resume, sessionId: current.sessionId };
      const { token, hash } = mint(runId);
      opts.store.saveTokenHash(runId, hash, now());
      const baseUrl = opts.baseUrl();
      const route = { agent, baseUrl, runId, runDir, hook: opts.hook, token };
      const tools = project
        ? projectLaunch(route)
        : task
          ? { allow: agent.settings.allow, deny: [], mcpUrl: null, mcpConfigFile: null, mcpTools: null }
          : ticketLaunch({ ...route, projectAllow: prepared.delivery?.allow ?? [] });
      deps.guards.set(runId, turn.guard);
      const answer = current.pendingAnswer === null ? null : prepared.mentions(current.pendingAnswer);
      const prompt = project
        ? turn.brief
        : current.turns > 0
          ? withSection(section, answer ?? "")
          : firstPrompt(turn.brief, answer);
      const proc = launch({
        claudeBin,
        cwd,
        model: turn.flags.model,
        permissionFlag: flag,
        extraArgs: task?.extraArgs ?? [],
        sessionId: session.sessionId,
        resume: session.resume,
        prompt: session.resume ? prompt : titled(turn.promptTitle, prompt),
        systemPromptFile: turn.systemPromptFile,
        agentFlags: turn.agentFlags,
        addDirs,
        hook: opts.hook,
        ...tools,
        hookUrl: `${baseUrl}/hooks/${runId}`,
        token,
        baseEnv: env,
        extraEnv: { ...(task?.env ?? {}), ...(demo ? opts.demoAgent.env() : {}) },
      });
      live.set(runId, { hash, proc });
      registry.apply(runId, {
        type: "spawned",
        pid: proc.pid,
        resume: session.resume,
        workspace: prepared.label,
        cwd,
        guidelines: prepared.guidelines,
        ...(addDirs.length > 0 ? { addDirs } : {}),
        ...(session.sessionId === current.sessionId ? {} : { sessionId: session.sessionId }),
      });
      notifyLifecycle("spawn hook", opts.onSpawned, registry.get(runId));
      if (firstTicketTurn) markAnswersDelivered(current, prepared.answers);
      if (current.projectId && current.ticketId) startRules(runId, current.projectId, current.ticketId);
      const outcome = await proc.exited;
      live.delete(runId);
      deps.guards.delete(runId);
      if (deps.stopping()) return;
      const after = recordExit(runId, outcome, task);
      if (after?.state === "failed" || after?.state === "cancelled") proc.kill();
      if (after?.state === "done" && after.projectId && after.ticketId) {
        opts.data.runDone(after.projectId, after.ticketId);
      }
      if (after && after.pendingAnswer !== null && after.state !== "cancelled") {
        registry.apply(runId, { type: "requeued", rank: headRank(registry.all()) });
      }
      if (after) notifyLifecycle("turn end hook", opts.onTurnEnd, registry.get(runId));
    } catch (e) {
      live.get(runId)?.proc.kill();
      live.delete(runId);
      deps.guards.delete(runId);
      if (isTerminal(registry.get(runId).state)) console.error(`[kibo-daemon] run ${runId}`, e);
      else registry.apply(runId, { type: "failed", error: message(e) });
      if (!deps.stopping()) endedWithoutTurn(registry.get(runId));
    }
  }

  return run;
}
