import { readFileSync } from "node:fs";
import {
  KiboError,
  type ProjectSnapshot,
  ProposeBatchInput,
  type ProposedAction,
} from "../../packages/schema/src/index";
import { SILO_SCENARIO } from "./silo-suivi";

type ScenarioTurn = { proposals: unknown[]; result: string };
const QUESTION_REF = /^\{\{question:(.+)\}\}$/;

export type MemoryBatch = {
  id: string;
  seq: number;
  status: "pending" | "superseded";
  summary: string;
  actions: ProposedAction[];
};
export type MemoryAgent = {
  send(projectId: string, snapshot: ProjectSnapshot): { id: string; state: "done"; result: string };
  view(projectId: string): { session: { runId: string } | null; run: unknown; batches: MemoryBatch[] };
  onProposed(listener: (batch: MemoryBatch) => void): void;
};

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function turnOf(raw: unknown): ScenarioTurn {
  const result = field(raw, "result");
  if (typeof result !== "string") throw new KiboError("INVALID_INPUT", "a scenario turn has no result");
  const proposals = listOf(field(raw, "steps"))
    .filter((step) => field(step, "mcp") === "propose_batch")
    .map((step) => field(step, "input"));
  return { proposals, result };
}

export const scenarioTurns = (file: string = SILO_SCENARIO): ScenarioTurn[] =>
  listOf(field(JSON.parse(readFileSync(file, "utf8")), "turns")).map(turnOf);

function bind(value: unknown, snapshot: ProjectSnapshot): unknown {
  if (typeof value === "string") {
    const title = QUESTION_REF.exec(value)?.[1];
    if (title === undefined) return value;
    const found = snapshot.questions.find((q) => q.title === title);
    if (found === undefined) throw new KiboError("NOT_FOUND", `no question titled ${title}`);
    return found.id;
  }
  if (Array.isArray(value)) return value.map((v) => bind(v, snapshot));
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bind(v, snapshot)]));
  return value;
}

export function createMemoryAgent(): MemoryAgent {
  const batches = new Map<string, MemoryBatch[]>();
  const runs = new Map<string, { id: string; state: "done"; result: string }>();
  const listeners: ((batch: MemoryBatch) => void)[] = [];
  const propose = (projectId: string, input: ProposeBatchInput) => {
    const list = batches.get(projectId) ?? [];
    const previous = list.map((b) => (b.status === "pending" ? { ...b, status: "superseded" as const } : b));
    const batch: MemoryBatch = { id: crypto.randomUUID(), seq: list.length + 1, status: "pending", ...input };
    batches.set(projectId, [...previous, batch]);
  };
  const journalTurnEnd = (projectId: string) => {
    const kept = batches.get(projectId)?.find((b) => b.status === "pending");
    if (kept !== undefined) for (const listener of listeners) listener(kept);
  };
  return {
    send(projectId, snapshot) {
      const turn = scenarioTurns()[0];
      if (turn === undefined) throw new KiboError("INTERNAL", "the scenario has no turn");
      for (const input of turn.proposals) propose(projectId, ProposeBatchInput.parse(bind(input, snapshot)));
      journalTurnEnd(projectId);
      const run = { id: crypto.randomUUID(), state: "done" as const, result: turn.result };
      runs.set(projectId, run);
      return run;
    },
    view(projectId) {
      const run = runs.get(projectId) ?? null;
      return { session: run && { runId: run.id }, run, batches: batches.get(projectId) ?? [] };
    },
    onProposed: (listener) => listeners.push(listener),
  };
}
