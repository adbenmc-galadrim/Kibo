import { clipDescription, clipPrompt, clipType, DEFAULT_SUBAGENT_TYPE } from "@kibo/schema";
import { type ContentBlock, parseTranscriptLine } from "./transcript-parse";

export type SubagentLaunch = {
  toolUseId: string;
  type: string;
  description: string;
  prompt: string;
  model: string | null;
};
export type SubagentToolResult = { toolUseId: string; isError: boolean; text: string | null };
export type SubagentSignals = {
  launches: SubagentLaunch[];
  results: SubagentToolResult[];
  model: string | null;
};

const LAUNCH_TOOLS: ReadonlySet<string> = new Set(["Agent", "Task"]);
const RESULT_TEXT_MAX = 4_000;

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

export function foldSubagentLaunch(
  block: Extract<ContentBlock, { type: "tool_use" }>,
): SubagentLaunch | null {
  if (!LAUNCH_TOOLS.has(block.name)) return null;
  const { input } = block;
  const type = textOf(input.subagent_type).trim();
  const model = textOf(input.model).trim();
  return {
    toolUseId: block.id,
    type: clipType(type === "" ? DEFAULT_SUBAGENT_TYPE : type),
    description: clipDescription(textOf(input.description)),
    prompt: clipPrompt(textOf(input.prompt)),
    model: model === "" ? null : clipType(model),
  };
}

export function subagentSignals(lines: readonly string[]): SubagentSignals {
  const signals: SubagentSignals = { launches: [], results: [], model: null };
  for (const line of lines) {
    const parsed = parseTranscriptLine(line);
    if (parsed.kind === "assistant") signals.model ??= parsed.model;
    if (parsed.kind === "assistant")
      for (const block of parsed.blocks) {
        const launch = block.type === "tool_use" ? foldSubagentLaunch(block) : null;
        if (launch) signals.launches.push(launch);
      }
    if (parsed.kind === "user")
      for (const result of parsed.results)
        signals.results.push({
          toolUseId: result.tool_use_id,
          isError: result.is_error,
          text: result.content === null ? null : result.content.slice(0, RESULT_TEXT_MAX),
        });
  }
  return signals;
}
