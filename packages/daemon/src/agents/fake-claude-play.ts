import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { mcpToolName } from "@kibo/schema";
import {
  appendContext,
  appendToolUse,
  appendWrite,
  contextOf,
  decisionOf,
  denialReason,
  isDemoAgent,
  resolveStepInput,
  runDeleteStep,
  runWriteStep,
  type WriteLog,
} from "./fake-claude-ai";
import { bindPlaceholders, callMcpTool, type McpCallLog, mcpServerFrom } from "./fake-claude-mcp";
import type { FakeStep } from "./fake-claude-scenario";
import {
  asInput,
  hookExtra,
  hookOutcome,
  mcpOutcome,
  type ToolOutcome,
  type ToolTrail,
  type Transcript,
  writeOutcome,
} from "./fake-claude-transcript";

export type HookRun = { code: number; stdout: string };
export type PlayContext = {
  argv: string[];
  stateDir: string;
  sessionId: string;
  launcher: number;
  transcript: Transcript;
  trail: ToolTrail;
  runHooks(event: string, extra: Record<string, unknown>): Promise<HookRun[]>;
  denials: string[];
  mcpCalls: McpCallLog[];
};
export type Player = { playAll(steps: readonly FakeStep[]): Promise<string | null> };

type SkillStep = { skill: string; args?: string; denied: boolean };
type SubagentStep = { subagent: string; steps: FakeStep[] };

const deniedBy = (runs: HookRun[]) =>
  runs.some((r) => r.code === 2 || (r.code === 0 && decisionOf(r.stdout) === "deny"));
const text = (content: string): ToolOutcome => ({ content, isError: false, toolUseResult: content });

export function createPlayer(ctx: PlayContext): Player {
  const { transcript, trail, stateDir, sessionId } = ctx;
  const logUse = (tool: string, input: Record<string, unknown>, denied: boolean) =>
    appendToolUse(stateDir, sessionId, { tool, input, denied });

  const toolHooks = async (event: string, extra: Record<string, unknown>, outcome: () => ToolOutcome) => {
    const tool = typeof extra.tool_name === "string" ? extra.tool_name : "";
    const input = asInput(extra.tool_input);
    const id =
      event === "PreToolUse" && tool
        ? trail.before(tool, input)
        : event === "PostToolUse" && tool
          ? trail.after(tool, input, outcome())
          : null;
    const runs = await ctx.runHooks(event, id === null ? extra : { ...extra, tool_use_id: id });
    const refused = event === "PreToolUse" && deniedBy(runs);
    if (refused && tool) trail.denied(tool, denialReason(runs.map((r) => r.stdout)));
    if (event === "PreToolUse") journalContexts(tool, runs);
    return { runs, refused };
  };

  function journalContexts(tool: string, runs: HookRun[]): void {
    for (const run of runs) {
      const additionalContext = run.code === 0 ? contextOf(run.stdout) : null;
      if (additionalContext) appendContext(stateDir, sessionId, { at: Date.now(), tool, additionalContext });
    }
  }

  async function mcp(step: { mcp: string; input: Record<string, unknown> }): Promise<void> {
    const server = mcpServerFrom(ctx.argv);
    const call = { tool_name: mcpToolName(step.mcp), tool_input: bindPlaceholders(step.input, ctx.mcpCalls) };
    const { refused } = await toolHooks("PreToolUse", call, () => mcpOutcome("", false));
    logUse(call.tool_name, call.tool_input, refused);
    if (refused) {
      ctx.denials.push(call.tool_name);
      return;
    }
    const reply = await callMcpTool(server, step.mcp, call.tool_input);
    ctx.mcpCalls.push({ tool: step.mcp, ...reply });
    const response = { tool_response: [{ type: "text", text: reply.text }] };
    await toolHooks("PostToolUse", { ...call, ...response }, () => mcpOutcome(reply.text, reply.isError));
  }

  async function hook(step: Extract<FakeStep, { hook: string }>): Promise<void> {
    const resolved = resolveStepInput(step.input, process.env);
    const tool = step.tool ? { tool_name: step.tool } : {};
    const input = resolved ? { tool_input: resolved } : {};
    const extra = { ...tool, ...input, ...hookExtra(step.extra) };
    const { refused } = await toolHooks(step.hook, extra, () =>
      hookOutcome(step.extra ?? {}, resolved ?? {}),
    );
    if (refused) ctx.denials.push(step.tool ?? "?");
    if (step.hook === "PreToolUse" && step.tool) logUse(step.tool, resolved ?? {}, refused);
  }

  const fileStep = (outcome: (extra: Record<string, unknown>) => ToolOutcome) => ({
    cwd: process.cwd(),
    allowBypass: !isDemoAgent(import.meta.dir, process.env),
    hook: async (event: "PreToolUse" | "PostToolUse", extra: Record<string, unknown>) => {
      const { runs, refused } = await toolHooks(event, extra, () => outcome(extra));
      return refused ? (denialReason(runs.map((r) => r.stdout)) ?? "denied") : null;
    },
    log: (logged: WriteLog) => appendWrite(stateDir, sessionId, logged),
  });

  async function write(step: Extract<FakeStep, { write: string }>): Promise<void> {
    const entry = await runWriteStep(step, fileStep(writeOutcome));
    if ("denied" in entry) ctx.denials.push("Write");
  }

  async function remove(step: Extract<FakeStep, { delete: string }>): Promise<void> {
    const entry = await runDeleteStep(
      step,
      fileStep((extra) => hookOutcome(extra, asInput(extra.tool_input))),
    );
    if ("denied" in entry) ctx.denials.push("Bash");
  }

  async function skill(step: SkillStep): Promise<void> {
    const call = {
      tool_name: "Skill",
      tool_input: { skill: step.skill, ...(step.args === undefined ? {} : { args: step.args }) },
    };
    const { refused } = await toolHooks("PreToolUse", call, () => text(""));
    if (!refused && step.denied) trail.denied("Skill");
    logUse("Skill", call.tool_input, refused || step.denied);
    if (refused || step.denied) {
      ctx.denials.push("Skill");
      return;
    }
    const launched = `Launching skill: ${step.skill}`;
    await toolHooks("PostToolUse", { ...call, tool_response: launched }, () => text(launched));
  }

  async function subagent(step: SubagentStep): Promise<void> {
    const call = {
      tool_name: "Agent",
      tool_input: {
        subagent_type: step.subagent,
        description: `Sous-agent ${step.subagent}`,
        prompt: "Fais ta part.",
      },
    };
    const { refused } = await toolHooks("PreToolUse", call, () => text(""));
    logUse("Agent", call.tool_input, refused);
    if (refused) {
      ctx.denials.push("Agent");
      return;
    }
    const agent = { agent_id: `agent_${randomUUID().replaceAll("-", "")}`, agent_type: step.subagent };
    await ctx.runHooks("SubagentStart", agent);
    transcript.sidechain(true);
    const failure = await playAll(step.steps).finally(() => transcript.sidechain(false));
    if (failure !== null) throw new Error(failure);
    const done = `Sous-agent ${step.subagent} terminé.`;
    await ctx.runHooks("SubagentStop", { ...agent, stop_hook_active: false, last_assistant_message: done });
    await toolHooks("PostToolUse", { ...call, tool_response: done }, () => text(done));
  }

  async function hold(): Promise<void> {
    const release = join(stateDir, `${sessionId}.release`);
    while (!existsSync(release)) {
      if (process.ppid !== ctx.launcher) process.exit(1);
      await Bun.sleep(25);
    }
    rmSync(release);
  }

  async function play(step: FakeStep): Promise<void> {
    if ("say" in step) return transcript.say(step.say);
    if ("think" in step) return transcript.think(step.think);
    if ("raw" in step) return transcript.raw(step.raw);
    if ("mcp" in step) return mcp(step);
    if ("hook" in step) return hook(step);
    if ("write" in step) return write(step);
    if ("delete" in step) return remove(step);
    if ("skill" in step) return skill(step);
    if ("subagent" in step) return subagent(step);
    if ("sleepMs" in step) return Bun.sleep(step.sleepMs);
    if ("hold" in step) return hold();
    process.stderr.write(`${step.stderr}\n`);
  }

  async function playAll(steps: readonly FakeStep[]): Promise<string | null> {
    for (const step of steps) {
      try {
        await play(step);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        process.stderr.write(`fake-claude: ${message}\n`);
        return message;
      }
    }
    return null;
  }

  return { playAll };
}
