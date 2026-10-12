import {
  actionLabel,
  actionOf,
  actionsFailed,
  denialOf,
  MOMENT_ACTIONS_MAX,
  MOMENT_DETAIL_MAX,
  MOMENT_MESSAGE_MAX,
  MOMENT_RAW_MAX,
  type MomentData,
  maskSecrets,
  maskSecretsWithin,
  type RunAction,
  summarizeActions,
} from "@kibo/schema";
import {
  type ContentBlock,
  type ParsedLine,
  parseTranscriptLine,
  patchOf,
  type ToolResult,
} from "./transcript-parse";

export type PendingCall = { tool: string; input: Record<string, unknown>; sidechain: boolean };
export type FoldState = {
  pending: ReadonlyMap<string, PendingCall>;
  actions: readonly RunAction[];
  actionsAt: number | null;
  known: boolean;
};
export type FoldContext = { stepId: string | null; now: number };
export type FoldedMoment = { data: MomentData; at: number; stepId: string | null };
export type Folded = { state: FoldState; moments: FoldedMoment[] };

const TARGET_MAX = 500;
const LABEL_MAX = 200;
const SUMMARY_MAX = 300;

export const emptyFold = (): FoldState => ({
  pending: new Map(),
  actions: [],
  actionsAt: null,
  known: false,
});

function maskValue(value: unknown): unknown {
  if (typeof value === "string") return maskSecrets(value);
  if (Array.isArray(value)) return value.map(maskValue);
  if (typeof value === "object" && value !== null) return maskInput(value);
  return value;
}

const maskInput = (input: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, maskValue(value)]));

const CALL_ID_MAX = 64;
const callIdOf = (id: string): { callId?: string } =>
  id.length > 0 && id.length <= CALL_ID_MAX ? { callId: id } : {};

function maskedAction(
  id: string,
  call: PendingCall,
  result: ToolResult | null,
  toolUseResult: unknown,
): RunAction {
  const content = result?.content ?? null;
  const output = content === null ? null : maskSecrets(content);
  const isError = result?.is_error ?? false;
  const action = actionOf({
    tool: call.tool,
    input: maskInput(call.input),
    output,
    isError,
    denied: isError && denialOf(output),
    patch: patchOf(toolUseResult),
  });
  const target = action.target === null ? null : maskSecretsWithin(action.target, TARGET_MAX);
  const detail = action.detail === null ? null : maskSecretsWithin(action.detail, MOMENT_DETAIL_MAX);
  const base = { ...action, target, detail };
  return { ...base, label: maskSecretsWithin(actionLabel(base), LABEL_MAX), ...callIdOf(id) };
}

class Folder {
  private readonly pending: Map<string, PendingCall>;
  private actions: RunAction[];
  private actionsAt: number | null;
  private known: boolean;
  readonly moments: FoldedMoment[] = [];

  constructor(
    state: FoldState,
    private readonly ctx: FoldContext,
  ) {
    this.pending = new Map(state.pending);
    this.actions = [...state.actions];
    this.actionsAt = state.actionsAt;
    this.known = state.known;
  }

  state(): FoldState {
    return { pending: this.pending, actions: this.actions, actionsAt: this.actionsAt, known: this.known };
  }

  line(parsed: ParsedLine): void {
    if (parsed.kind === "raw") {
      this.raw(parsed.text);
      return;
    }
    this.known = true;
    if (parsed.kind === "assistant") for (const block of parsed.blocks) this.block(block, parsed);
    if (parsed.kind === "user") {
      const toolUseResult = parsed.results.length === 1 ? parsed.toolUseResult : null;
      for (const result of parsed.results) this.result(result, toolUseResult, parsed.at);
    }
  }

  flushPending(): void {
    for (const [id, call] of this.pending) this.push(maskedAction(id, call, null, null), null);
    this.pending.clear();
    this.flush();
  }

  private block(block: ContentBlock, line: Extract<ParsedLine, { kind: "assistant" }>): void {
    if (block.type === "tool_use") {
      this.pending.set(block.id, { tool: block.name, input: block.input, sidechain: line.sidechain });
      return;
    }
    if (line.sidechain) return;
    if (block.type === "text") this.say("message", block.text, line.at);
    if (block.type === "thinking") this.say("reasoning", block.thinking, line.at);
  }

  private say(kind: "message" | "reasoning", text: string, at: number | null): void {
    if (text.trim() === "") return;
    this.flush();
    this.emit({ kind, text: maskSecretsWithin(text, MOMENT_MESSAGE_MAX) }, at);
  }

  private raw(text: string): void {
    this.flush();
    this.emit({ kind: "raw", text: maskSecretsWithin(text, MOMENT_RAW_MAX), partial: null }, null);
  }

  private result(result: ToolResult, toolUseResult: unknown, at: number | null): void {
    const call = this.pending.get(result.tool_use_id) ?? { tool: "", input: {}, sidechain: false };
    this.pending.delete(result.tool_use_id);
    this.push(maskedAction(result.tool_use_id, call, result, toolUseResult), at);
  }

  private push(action: RunAction, at: number | null): void {
    if (this.actions.length >= MOMENT_ACTIONS_MAX) this.flush();
    if (this.actions.length === 0) this.actionsAt = at;
    this.actions.push(action);
  }

  private flush(): void {
    if (this.actions.length === 0) return;
    const actions = this.actions;
    const summary = maskSecretsWithin(summarizeActions(actions), SUMMARY_MAX);
    this.emit({ kind: "actions", actions, summary, failed: actionsFailed(actions) }, this.actionsAt);
    this.actions = [];
    this.actionsAt = null;
  }

  private emit(data: MomentData, at: number | null): void {
    this.moments.push({ data, at: at ?? this.ctx.now, stepId: this.ctx.stepId });
  }
}

export function foldLines(state: FoldState, lines: readonly string[], ctx: FoldContext): Folded {
  const folder = new Folder(state, ctx);
  for (const line of lines) folder.line(parseTranscriptLine(line));
  return { state: folder.state(), moments: folder.moments };
}

export function flushActions(state: FoldState, ctx: FoldContext): Folded {
  const folder = new Folder(state, ctx);
  folder.flushPending();
  return { state: folder.state(), moments: folder.moments };
}
