import {
  StructuredPatch,
  TextBlock,
  ThinkingBlock,
  ToolResultBlock,
  ToolUseBlock,
  TranscriptEntry,
} from "./transcript-entry";

export type ToolResult = {
  type: "tool_result";
  tool_use_id: string;
  content: string | null;
  is_error: boolean;
};
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | ToolResult;

export type ParsedLine =
  | { kind: "assistant"; blocks: ContentBlock[]; sidechain: boolean; at: number | null }
  | {
      kind: "user";
      text: string | null;
      results: ToolResult[];
      toolUseResult: unknown;
      sidechain: boolean;
      at: number | null;
    }
  | { kind: "ignored" }
  | { kind: "raw"; text: string };

export const IGNORED_ENTRY_TYPES: readonly string[] = [
  "summary",
  "system",
  "progress",
  "file-history-snapshot",
  "queue-operation",
  "attachment",
  "atis-latch",
  "last-prompt",
  "cost-state",
];

const IGNORED: ParsedLine = { kind: "ignored" };

function jsonOf(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

const blocksOf = (content: string | unknown[]): unknown[] =>
  typeof content === "string" ? [{ type: "text", text: content }] : content;

const textsOf = (content: string | unknown[]): string[] =>
  blocksOf(content).flatMap((block) => {
    const text = TextBlock.safeParse(block);
    return text.success ? [text.data.text] : [];
  });

const joined = (texts: readonly string[]): string | null => (texts.length > 0 ? texts.join("\n") : null);

function assistantBlock(block: unknown): ContentBlock[] {
  const text = TextBlock.safeParse(block);
  if (text.success) return [{ type: "text", text: text.data.text }];
  const thinking = ThinkingBlock.safeParse(block);
  if (thinking.success) return [{ type: "thinking", thinking: thinking.data.thinking }];
  const use = ToolUseBlock.safeParse(block);
  if (use.success) return [{ type: "tool_use", id: use.data.id, name: use.data.name, input: use.data.input }];
  return [];
}

function toolResult(block: unknown): ToolResult[] {
  const result = ToolResultBlock.safeParse(block);
  if (!result.success) return [];
  const { content } = result.data;
  return [
    {
      type: "tool_result",
      tool_use_id: result.data.tool_use_id,
      content: content === null || content === undefined ? null : (joined(textsOf(content)) ?? null),
      is_error: result.data.is_error === true,
    },
  ];
}

function dateOf(timestamp: unknown): number | null {
  if (typeof timestamp !== "string") return null;
  const at = Date.parse(timestamp);
  return Number.isFinite(at) ? at : null;
}

function userLine(entry: TranscriptEntry, content: string | unknown[]): ParsedLine {
  const blocks = blocksOf(content);
  return {
    kind: "user",
    text: joined(blocks.flatMap((b) => textsOf([b]))),
    results: blocks.flatMap(toolResult),
    toolUseResult: entry.toolUseResult ?? null,
    sidechain: entry.isSidechain,
    at: dateOf(entry.timestamp),
  };
}

export function parseTranscriptLine(line: string): ParsedLine {
  if (line.trim() === "") return IGNORED;
  const raw: ParsedLine = { kind: "raw", text: line };
  const parsed = TranscriptEntry.safeParse(jsonOf(line));
  if (!parsed.success) return raw;
  const entry = parsed.data;
  if (IGNORED_ENTRY_TYPES.includes(entry.type)) return IGNORED;
  const content = entry.message?.content;
  if (content === undefined) return raw;
  if (entry.type === "user") return userLine(entry, content);
  if (entry.type !== "assistant") return raw;
  return {
    kind: "assistant",
    blocks: blocksOf(content).flatMap(assistantBlock),
    sidechain: entry.isSidechain,
    at: dateOf(entry.timestamp),
  };
}

const isHeader = (line: string): boolean => line.startsWith("+++") || line.startsWith("---");

export function patchOf(toolUseResult: unknown): { added: number; removed: number } | null {
  const parsed = StructuredPatch.safeParse(toolUseResult);
  if (!parsed.success) return null;
  const lines = parsed.data.structuredPatch.flatMap((hunk) => hunk.lines).filter((l) => !isHeader(l));
  return {
    added: lines.filter((l) => l.startsWith("+")).length,
    removed: lines.filter((l) => l.startsWith("-")).length,
  };
}
