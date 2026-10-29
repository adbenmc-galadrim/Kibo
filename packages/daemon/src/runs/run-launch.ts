import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { headRank } from "@kibo/core/scheduler";
import { type Agent, isProjectRun, isTerminal, RunEvent, type RunView } from "@kibo/schema";
import { addDirsOf, realpathOrNull } from "./add-dirs";
import { NO_CLI_FALLBACKS } from "./cli-flags";
import type { OrchestratorOptions, ToolGuard } from "./orchestrator-types";
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
import { decideProjectSession, type SessionDecision } from "./session-decision";
import { transcriptTokensAt } from "./transcript";

export type LiveRun = { hash: string; proc: RunProcess };
export type LaunchDeps = {
  opts: OrchestratorOptions;
  registry: RunRegistry;
  live: Map<string, LiveRun>;
  agentOf: (ref: string) => Agent;
  guards: Map<string, ToolGuard>;
  stopping: () => boolean;
};

const TICKET_RUN_REMOVED = "AGENT_EXECUTION_REMOVED: Kibo no longer runs ticket agents";
const EXIT_STATES = new Set(["starting", "running", "done", "failed", "cancelled"]);
const titled = (title: string | null, prompt: string) => (title === null ? prompt : `${title}\n\n${prompt}`);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const transcriptExists = (path: string | null) => path !== null && existsSync(path);

export function createRunLauncher(deps: LaunchDeps): (runId: string) => Promise<void> {
  const { opts, registry, live } = deps;
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
  });

  function recordExit(runId: string, outcome: ProcessOutcome): RunView | null {
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
    });
    return registry.apply(runId, exited);
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

  function endedWithoutTurn(view: RunView): void {
    if (isTerminal(view.state)) notifyLifecycle("no turn end hook", opts.onEndedWithoutTurn, view);
  }

  async function run(runId: string): Promise<void> {
    const initial = registry.get(runId);
    const runDir = join(opts.home, "runs", runId);
    try {
      if (!isProjectRun(initial)) {
        registry.apply(runId, { type: "failed", error: TICKET_RUN_REMOVED });
        return;
      }
      const agent = deps.agentOf(initial.profileId);
      const prepared = await turns.project(initial, runDir);
      const { turn } = prepared;
      const userHome = opts.userHome ?? homedir();
      const claudeBin = resolveClaudeBin(opts.claudeBin, env, userHome);
      const addDirs = addDirsOf(agent.settings, prepared.delivery, {
        home: userHome,
        realpath: realpathOrNull,
        log: (line) => console.error(`[kibo-daemon] run ${runId}: ${line}`),
      });
      const flag = permissionFlag(agent.settings.permissionMode, await capsOf(claudeBin));
      const current = registry.get(runId);
      if (deps.stopping()) return;
      if (current.state !== "starting") return endedWithoutTurn(current);
      const cwd = realpathSync(prepared.cwd);
      const session = journalSession(
        current,
        decideProjectSession(current, transcriptExists, () => crypto.randomUUID()),
      );
      const { token, hash } = mint(runId);
      opts.store.saveTokenHash(runId, hash, now());
      const baseUrl = opts.baseUrl();
      const route = { agent, baseUrl, runId, runDir, hook: opts.hook, token };
      const tools = projectLaunch(route);
      deps.guards.set(runId, turn.guard);
      const prompt = turn.brief;
      const proc = launch({
        claudeBin,
        cwd,
        model: turn.flags.model,
        permissionFlag: flag,
        extraArgs: [],
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
        extraEnv: {},
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
      const outcome = await proc.exited;
      live.delete(runId);
      deps.guards.delete(runId);
      if (deps.stopping()) return;
      const after = recordExit(runId, outcome);
      if (after?.state === "failed" || after?.state === "cancelled") proc.kill();
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
