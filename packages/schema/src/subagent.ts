import { z } from "zod";
import type { RunMomentsPage } from "./moment";
import { maskSecretsWithin } from "./secret-mask";

export const SUBAGENT_PROMPT_MAX = 8_000;
export const SUBAGENT_RESULT_MAX = 2_000;
export const SUBAGENT_TYPE_MAX = 100;
export const SUBAGENT_DESCRIPTION_MAX = 200;
export const SUBAGENT_ID_MAX = 200;
export const DEFAULT_SUBAGENT_TYPE = "general-purpose";

export const SubagentState = z.enum(["running", "done", "failed"]);
export type SubagentState = z.infer<typeof SubagentState>;

const SubagentId = z.string().min(1).max(SUBAGENT_ID_MAX);

export const RunSubagent = z.object({
  id: SubagentId,
  runId: z.string().min(1),
  toolUseId: z.string().max(SUBAGENT_ID_MAX).nullable(),
  type: z.string().max(SUBAGENT_TYPE_MAX),
  description: z.string().max(SUBAGENT_DESCRIPTION_MAX),
  prompt: z.string().max(SUBAGENT_PROMPT_MAX),
  model: z.string().max(SUBAGENT_TYPE_MAX).nullable(),
  state: SubagentState,
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
  result: z.string().max(SUBAGENT_RESULT_MAX).nullable(),
  actions: z.number().int().nonnegative(),
  parentId: SubagentId.nullable(),
  transcriptPath: z.string().max(4_096).nullable(),
});
export type RunSubagent = z.infer<typeof RunSubagent>;
export type RunSubagentSummary = Pick<
  RunSubagent,
  "runId" | "id" | "type" | "description" | "state" | "startedAt"
>;

export type SubagentRow = Omit<RunSubagent, "state" | "endedAt" | "result" | "actions">;
export type SubagentFacts = Partial<
  Pick<SubagentRow, "toolUseId" | "type" | "description" | "prompt" | "model" | "parentId" | "transcriptPath">
>;
export type SubagentEvent =
  | { type: "started"; at: number }
  | { type: "linked"; at: number; facts: SubagentFacts }
  | { type: "ended"; at: number; isError: boolean; result: string | null };
export type SubagentTraceFacts = { actions: number; lastText: string | null };

export const clipPrompt = (text: string): string => maskSecretsWithin(text, SUBAGENT_PROMPT_MAX);
export const clipResult = (text: string): string => maskSecretsWithin(text, SUBAGENT_RESULT_MAX);
export const clipType = (text: string): string => maskSecretsWithin(text, SUBAGENT_TYPE_MAX);
export const clipDescription = (text: string): string => maskSecretsWithin(text, SUBAGENT_DESCRIPTION_MAX);

const FACT_KEYS = [
  "toolUseId",
  "type",
  "description",
  "prompt",
  "model",
  "parentId",
  "transcriptPath",
] as const;

const isUnknown = (value: string | null): boolean => value === null || value === "";

function withFacts(row: SubagentRow, facts: SubagentFacts): SubagentRow {
  const next = { ...row };
  for (const key of FACT_KEYS) {
    const value = facts[key];
    if (value === undefined || isUnknown(value) || !isUnknown(next[key])) continue;
    Object.assign(next, { [key]: value });
  }
  return next;
}

export function foldSubagent(
  row: SubagentRow,
  events: readonly SubagentEvent[],
  trace: SubagentTraceFacts = { actions: 0, lastText: null },
): RunSubagent {
  let facts = row;
  let startedAt: number | null = null;
  const ended = events.filter((e) => e.type === "ended");
  for (const event of events) {
    if (event.type === "linked") facts = withFacts(facts, event.facts);
    if (event.type === "started" && startedAt === null) startedAt = event.at;
  }
  const failed = ended.some((e) => e.isError);
  const endedResult = ended.find((e) => e.result !== null)?.result ?? null;
  const result = trace.lastText ?? endedResult;
  return {
    ...facts,
    type: facts.type === "" ? DEFAULT_SUBAGENT_TYPE : facts.type,
    state: failed ? "failed" : ended.length > 0 ? "done" : "running",
    startedAt: startedAt ?? row.startedAt,
    endedAt: ended.length > 0 ? Math.min(...ended.map((e) => e.at)) : null,
    result: result === null ? null : clipResult(result),
    actions: trace.actions,
  };
}

export const summarizeSubagent = (s: RunSubagent): RunSubagentSummary => ({
  runId: s.runId,
  id: s.id,
  type: s.type,
  description: s.description,
  state: s.state,
  startedAt: s.startedAt,
});

export const SUBAGENT_RPC = [
  z.object({ method: z.literal("runs.subagents"), runId: z.string().min(1) }),
  z.object({
    method: z.literal("runs.subagentMoments"),
    runId: z.string().min(1),
    subagentId: SubagentId,
    after: z.number().int().nonnegative().optional(),
  }),
] as const;
export type SubagentRpcRequest = z.infer<(typeof SUBAGENT_RPC)[number]>;
export type SubagentRpcResult = { "runs.subagents": RunSubagent[]; "runs.subagentMoments": RunMomentsPage };

const SUBAGENT_METHODS: ReadonlySet<string> = new Set(SUBAGENT_RPC.map((s) => s.shape.method.value));
export const isSubagentRequest = (req: { method: string }): boolean => SUBAGENT_METHODS.has(req.method);
