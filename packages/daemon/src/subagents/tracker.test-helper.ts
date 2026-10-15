import { Database } from "bun:sqlite";
import type { SubagentLaunch } from "@kibo/core";
import type { HookPayload } from "@kibo/schema";
import { createSubagentStore, type SubagentStore } from "./store";
import {
  createSubagentTracker,
  type SubagentAnnounce,
  type SubagentMeta,
  type SubagentTracker,
} from "./tracker";

export const RUN = "r1";
export const AGENT = "a1";
export const TOOL_USE = "toolu_1";

export const LAUNCH: SubagentLaunch = {
  toolUseId: TOOL_USE,
  type: "ecc:code-reviewer",
  description: "Porte qualité — correctness",
  prompt: "Relis le diff",
  model: "opus",
};
export const META: SubagentMeta = {
  agentId: AGENT,
  agentType: "ecc:code-reviewer",
  description: "Porte qualité — correctness",
  toolUseId: TOOL_USE,
  spawnDepth: 1,
  model: "opus",
};

export const hook = (event: "SubagentStart" | "SubagentStop", agentId = AGENT): HookPayload => ({
  event,
  sessionId: "s1",
  transcriptPath: null,
  tool: "ecc:code-reviewer",
  detail: event === "SubagentStop" ? "RAS" : null,
  question: null,
  agentId,
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
});

export type Tracked = { tracker: SubagentTracker; store: SubagentStore; announced: SubagentAnnounce[] };

export function tracked(now: () => number = () => 1_000): Tracked {
  const store = createSubagentStore(new Database(":memory:", { strict: true }));
  const announced: SubagentAnnounce[] = [];
  const tracker = createSubagentTracker({
    store,
    now,
    transcriptOf: (_runId, agentId) => `/p/s1/subagents/agent-${agentId}.jsonl`,
    announce: (_runId, moment) => announced.push(moment),
  });
  return { tracker, store, announced };
}
