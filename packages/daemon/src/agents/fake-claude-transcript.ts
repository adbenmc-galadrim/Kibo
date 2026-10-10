import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { Usage } from "./transcript";

export const FAKE_CLAUDE_VERSION = "2.1.283";

export type LineContext = { sessionId: string; cwd: string; parentUuid: string | null; at?: Date };

export type TranscriptLine = {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: "external";
  cwd: string;
  sessionId: string;
  version: string;
  type: "user" | "assistant";
  uuid: string;
  timestamp: string;
  message: Record<string, unknown>;
  toolUseResult?: unknown;
};

export type TextContent = { type: "text"; text: string };
export type ToolOutcome = { content: string | TextContent[]; isError: boolean; toolUseResult?: unknown };
export type FakePatch = { added: number; removed: number };

const base = (ctx: LineContext, type: TranscriptLine["type"]): Omit<TranscriptLine, "message"> => ({
  parentUuid: ctx.parentUuid,
  isSidechain: false,
  userType: "external",
  cwd: ctx.cwd,
  sessionId: ctx.sessionId,
  version: FAKE_CLAUDE_VERSION,
  type,
  uuid: randomUUID(),
  timestamp: (ctx.at ?? new Date()).toISOString(),
});

function assistantLine(ctx: LineContext, content: unknown[], usage?: Usage): TranscriptLine {
  const line = base(ctx, "assistant");
  const message = {
    id: `msg_${line.uuid}`,
    type: "message",
    role: "assistant",
    model: "claude-fake",
    content,
  };
  return { ...line, message: { ...message, stop_reason: null, ...(usage ? { usage } : {}) } };
}

export const userLine = (ctx: LineContext, prompt: string): TranscriptLine => ({
  ...base(ctx, "user"),
  message: { role: "user", content: prompt },
});

export const textLine = (ctx: LineContext, text: string, usage?: Usage): TranscriptLine =>
  assistantLine(ctx, [{ type: "text", text }], usage);

export const thinkingLine = (ctx: LineContext, thinking: string): TranscriptLine =>
  assistantLine(ctx, [{ type: "thinking", thinking, signature: "fake" }]);

export const toolUseLine = (
  ctx: LineContext,
  id: string,
  name: string,
  input: Record<string, unknown>,
): TranscriptLine => assistantLine(ctx, [{ type: "tool_use", id, name, input }]);

export function toolResultLine(ctx: LineContext, id: string, outcome: ToolOutcome): TranscriptLine {
  const result = { tool_use_id: id, type: "tool_result", content: outcome.content };
  return {
    ...base(ctx, "user"),
    message: { role: "user", content: [outcome.isError ? { ...result, is_error: true } : result] },
    ...(outcome.toolUseResult === undefined ? {} : { toolUseResult: outcome.toolUseResult }),
  };
}

export function appendTranscript(path: string, entry: TranscriptLine | string): void {
  appendFileSync(path, `${typeof entry === "string" ? entry : JSON.stringify(entry)}\n`);
}

export function structuredPatch({ added, removed }: FakePatch) {
  const lines = [
    ...Array.from({ length: removed }, (_, i) => `-ancienne ligne ${i + 1}`),
    ...Array.from({ length: added }, (_, i) => `+nouvelle ligne ${i + 1}`),
  ];
  return [{ oldStart: 1, oldLines: removed, newStart: 1, newLines: added, lines }];
}

const count = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

function patchOf(extra: Record<string, unknown>): FakePatch | null {
  const patch = extra.patch;
  if (typeof patch !== "object" || patch === null) return null;
  return { added: count(Reflect.get(patch, "added")), removed: count(Reflect.get(patch, "removed")) };
}

export function hookOutcome(extra: Record<string, unknown>, input: Record<string, unknown>): ToolOutcome {
  const response = extra.tool_response;
  const content = typeof response === "string" ? response : JSON.stringify(response ?? "ok");
  const patch = patchOf(extra);
  const toolUseResult = patch
    ? { filePath: input.file_path ?? null, structuredPatch: structuredPatch(patch) }
    : response;
  return { content, isError: extra.is_error === true, toolUseResult };
}

export const hookExtra = (extra: Record<string, unknown> | undefined): Record<string, unknown> =>
  Object.fromEntries(Object.entries(extra ?? {}).filter(([key]) => key !== "patch" && key !== "is_error"));

export const denialOutcome = (tool: string): ToolOutcome => ({
  content: `Permission to use ${tool} has been denied.`,
  isError: true,
});

export const mcpOutcome = (text: string, isError: boolean): ToolOutcome => {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, isError, toolUseResult: content };
};

export const asInput = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

export function writeOutcome(extra: Record<string, unknown>): ToolOutcome {
  const input = asInput(extra.tool_input);
  const filePath = typeof input.file_path === "string" ? input.file_path : "";
  return {
    content: `File created successfully at: ${filePath}`,
    isError: false,
    toolUseResult: { type: "create", filePath, content: input.content ?? "" },
  };
}

function lastUuid(path: string): string | null {
  if (!existsSync(path)) return null;
  const last = readFileSync(path, "utf8").trimEnd().split("\n").at(-1) ?? "";
  try {
    const uuid: unknown = Reflect.get(Object(JSON.parse(last)), "uuid");
    return typeof uuid === "string" ? uuid : null;
  } catch {
    return null;
  }
}

export type Transcript = {
  user(prompt: string): void;
  say(text: string, usage?: Usage): void;
  think(text: string): void;
  raw(line: string): void;
  toolUse(tool: string, input: Record<string, unknown>): string;
  toolResult(id: string, outcome: ToolOutcome): void;
};

export function openTranscript(path: string, sessionId: string, cwd: string): Transcript {
  let parentUuid = lastUuid(path);
  const add = (make: (ctx: LineContext) => TranscriptLine) => {
    const line = make({ sessionId, cwd, parentUuid });
    appendTranscript(path, line);
    parentUuid = line.uuid;
  };
  return {
    user: (prompt) => add((ctx) => userLine(ctx, prompt)),
    say: (text, usage) => add((ctx) => textLine(ctx, text, usage)),
    think: (text) => add((ctx) => thinkingLine(ctx, text)),
    raw: (line) => appendTranscript(path, line),
    toolUse(tool, input) {
      const id = `toolu_${randomUUID().replaceAll("-", "")}`;
      add((ctx) => toolUseLine(ctx, id, tool, input));
      return id;
    },
    toolResult: (id, outcome) => add((ctx) => toolResultLine(ctx, id, outcome)),
  };
}

export type ToolTrail = {
  before(tool: string, input: Record<string, unknown>): void;
  denied(tool: string): void;
  after(tool: string, input: Record<string, unknown>, outcome: ToolOutcome): void;
};

export function toolTrail(transcript: Transcript): ToolTrail {
  const pending = new Map<string, string>();
  const take = (tool: string): string | undefined => {
    const id = pending.get(tool);
    pending.delete(tool);
    return id;
  };
  return {
    before: (tool, input) => pending.set(tool, transcript.toolUse(tool, input)),
    denied(tool) {
      const id = take(tool);
      if (id) transcript.toolResult(id, denialOutcome(tool));
    },
    after: (tool, input, outcome) =>
      transcript.toolResult(take(tool) ?? transcript.toolUse(tool, input), outcome),
  };
}
