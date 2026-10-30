import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { mcpToolName } from "@kibo/schema";
import { bashResponse, runBash } from "./fake-claude-bash";
import { decisionOf, denialReason } from "./fake-claude-hooks";
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
} from "./fake-claude-transcript";

export type HookRun = { code: number; stdout: string };
export type PlayContext = {
  argv: string[];
  prompt: string;
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

const deniedBy = (runs: HookRun[]) =>
  runs.some((r) => r.code === 2 || (r.code === 0 && decisionOf(r.stdout) === "deny"));
const text = (content: string): ToolOutcome => ({ content, isError: false, toolUseResult: content });

export function createPlayer(ctx: PlayContext): Player {
  const { transcript, trail, stateDir, sessionId } = ctx;

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
    return { refused };
  };

  async function mcp(step: { mcp: string; input: Record<string, unknown> }): Promise<void> {
    const server = mcpServerFrom(ctx.argv);
    const call = {
      tool_name: mcpToolName(step.mcp),
      tool_input: bindPlaceholders(step.input, ctx.mcpCalls, ctx.prompt),
    };
    const { refused } = await toolHooks("PreToolUse", call, () => mcpOutcome("", false));
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
    const tool = step.tool ? { tool_name: step.tool } : {};
    const input = step.input ? { tool_input: step.input } : {};
    const extra = { ...tool, ...input, ...hookExtra(step.extra) };
    const { refused } = await toolHooks(step.hook, extra, () =>
      hookOutcome(step.extra ?? {}, step.input ?? {}),
    );
    if (refused) ctx.denials.push(step.tool ?? "?");
  }

  async function bash(command: string): Promise<void> {
    const call = { tool_name: "Bash", tool_input: { command } };
    const { refused } = await toolHooks("PreToolUse", call, () => text(""));
    if (refused) {
      ctx.denials.push("Bash");
      return;
    }
    const run = await runBash(command, stateDir, process.env);
    const response = bashResponse(run);
    const outcome = { content: run.stdout + run.stderr, isError: run.code !== 0, toolUseResult: response };
    await toolHooks("PostToolUse", { ...call, tool_response: response }, () => outcome);
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
    if ("bash" in step) return bash(step.bash);
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
