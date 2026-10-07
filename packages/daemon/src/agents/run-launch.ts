import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildRunContext, buildSystemPrompt, guidelineChain } from "@kibo/core/context";
import { headRank } from "@kibo/core/scheduler";
import { type AgentProfile, branchRefOf, isTerminal, KiboError, RunEvent, type RunView } from "@kibo/schema";
import { DEMO_PROFILE_ID, type OrchestratorOptions, type TaskSpec } from "./orchestrator-types";
import type { RunRegistry } from "./run-registry";
import { newRunToken } from "./run-token";
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
import { transcriptTokensAt } from "./transcript";
import { prepareWorkspace, writeRunContext } from "./workspace-prep";

export type LiveRun = { hash: string; proc: RunProcess };
export type LaunchDeps = {
  opts: OrchestratorOptions;
  registry: RunRegistry;
  tasks: Map<string, TaskSpec>;
  live: Map<string, LiveRun>;
  profileOf: (profileId: string) => AgentProfile;
  stopping: () => boolean;
};

type Prepared = { cwd: string; label: string; guidelines: number; brief: string; systemPromptFile: string };

const LOST_TASK = "INTERRUPTED: the task was lost when the daemon restarted";
const EXIT_STATES = new Set(["starting", "running", "done", "failed", "cancelled"]);
const firstPrompt = (brief: string, pending: string | null) =>
  pending === null ? brief : `${brief}\n\n${pending}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

  async function prepareTicketRun(run: RunView, profile: AgentProfile, runDir: string): Promise<Prepared> {
    if (!run.projectId || !run.ticketId) throw new KiboError("INVALID_INPUT", `run ${run.id} has no ticket`);
    const ctx = opts.data.ticketContext(run.projectId, run.ticketId);
    if (ctx.ticket.key === null)
      throw new KiboError("INVALID_INPUT", `ticket ${ctx.ticket.id} has no key yet`);
    const workspace = await prepareWorkspace({
      strategy: profile.workspace,
      projectFolder: ctx.project.meta.folder,
      ticketKey: ctx.ticket.key,
      runDir,
      worktree: ctx.project.meta.worktree,
      branchRef: branchRefOf(ctx.ticket.externalRefs),
    });
    const chain = guidelineChain(opts.data.guidelines(run.projectId), {
      projectId: run.projectId,
      domainId: ctx.ticket.domainId,
      profileId: profile.id,
    });
    const context = buildRunContext({ ...ctx, note: run.brief, chain, subagents: profile.subagents });
    const { systemPromptFile } = writeRunContext(runDir, context.files);
    return {
      cwd: workspace.cwd,
      label: workspace.label,
      guidelines: chain.length,
      brief: context.brief,
      systemPromptFile,
    };
  }

  function prepareTaskRun(run: RunView, profile: AgentProfile, task: TaskSpec, runDir: string): Prepared {
    const { systemPromptFile } = writeRunContext(runDir, [
      { path: "CLAUDE.md", content: buildSystemPrompt([], profile.subagents) },
      { path: "brief.md", content: run.brief },
    ]);
    return { cwd: task.cwd, label: task.cwd, guidelines: 0, brief: run.brief, systemPromptFile };
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

  function startRules(runId: string, projectId: string, ticketId: string): void {
    try {
      opts.data.runStarted(projectId, ticketId);
    } catch (e) {
      console.error(`[kibo-daemon] start rules of run ${runId} failed`, e);
    }
  }

  async function run(runId: string): Promise<void> {
    const initial = registry.get(runId);
    const task = initial.ticketId === null ? tasks.get(runId) : undefined;
    const runDir = join(opts.home, "runs", runId);
    try {
      if (initial.ticketId === null && !task) {
        registry.apply(runId, { type: "failed", error: LOST_TASK });
        return;
      }
      const resume = initial.turns > 0 || (task?.resume ?? false);
      const profile = deps.profileOf(initial.profileId);
      const prepared = task
        ? prepareTaskRun(initial, profile, task, runDir)
        : await prepareTicketRun(initial, profile, runDir);
      const demo = profile.id === DEMO_PROFILE_ID;
      const claudeBin = demo
        ? opts.demoAgent.bin
        : resolveClaudeBin(opts.claudeBin, env, opts.userHome ?? homedir());
      const flag = permissionFlag(profile.permissionMode, await capsOf(claudeBin));
      const current = registry.get(runId);
      if (deps.stopping() || current.state !== "starting") return;
      const cwd = realpathSync(prepared.cwd);
      const { token, hash } = mint(runId);
      opts.store.saveTokenHash(runId, hash, now());
      const proc = launch({
        claudeBin,
        cwd,
        model: profile.model,
        permissionFlag: flag,
        extraArgs: task?.extraArgs ?? [],
        sessionId: current.sessionId,
        resume,
        prompt:
          current.turns > 0
            ? (current.pendingAnswer ?? "")
            : firstPrompt(prepared.brief, current.pendingAnswer),
        systemPromptFile: prepared.systemPromptFile,
        hook: opts.hook,
        allow: profile.allow,
        hookUrl: `${opts.baseUrl()}/hooks/${runId}`,
        token,
        baseEnv: env,
        extraEnv: { ...(task?.env ?? {}), ...(demo ? opts.demoAgent.env() : {}) },
      });
      live.set(runId, { hash, proc });
      registry.apply(runId, {
        type: "spawned",
        pid: proc.pid,
        resume,
        workspace: prepared.label,
        cwd,
        guidelines: prepared.guidelines,
      });
      if (current.projectId && current.ticketId) startRules(runId, current.projectId, current.ticketId);
      const outcome = await proc.exited;
      live.delete(runId);
      if (deps.stopping()) return;
      const after = recordExit(runId, outcome, task);
      if (after?.state === "failed" || after?.state === "cancelled") proc.kill();
      if (after?.state === "done" && after.projectId && after.ticketId) {
        opts.data.runDone(after.projectId, after.ticketId);
      }
      if (after && after.pendingAnswer !== null && after.state !== "cancelled") {
        registry.apply(runId, { type: "requeued", rank: headRank(registry.all()) });
      }
    } catch (e) {
      live.get(runId)?.proc.kill();
      live.delete(runId);
      if (isTerminal(registry.get(runId).state)) console.error(`[kibo-daemon] run ${runId}`, e);
      else registry.apply(runId, { type: "failed", error: message(e) });
    }
  }

  return run;
}
