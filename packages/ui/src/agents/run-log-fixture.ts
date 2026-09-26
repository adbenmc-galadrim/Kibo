import type { HookEventName, HookPayload, RunLogEntry } from "@kibo/schema";
import { NOW } from "./fixtures";

const MIN = 60_000;

export const hook = (event: HookEventName, p: Partial<HookPayload>): HookPayload => ({
  event,
  sessionId: "s-r41",
  transcriptPath: null,
  tool: null,
  detail: null,
  question: null,
  agentId: null,
  ...p,
});

export const RUN_LOG: RunLogEntry[] = [
  { id: 10, at: NOW - 8 * MIN, event: { type: "enqueued", rank: 1 } },
  { id: 11, at: NOW - 7 * MIN, event: { type: "admitted", lane: 2 } },
  {
    id: 1,
    at: NOW - 7 * MIN,
    event: { type: "spawned", pid: 42, resume: false, workspace: "worktree:kib-14", guidelines: 3 },
  },
  {
    id: 12,
    at: NOW - 7 * MIN,
    event: { type: "hook", payload: hook("SessionStart", { detail: "startup" }) },
  },
  {
    id: 2,
    at: NOW - 5 * MIN,
    event: {
      type: "hook",
      payload: hook("PreToolUse", { tool: "Write", detail: "apps/daemon/src/hooks/receiver.ts" }),
    },
  },
  {
    id: 3,
    at: NOW - 5 * MIN,
    event: {
      type: "hook",
      payload: hook("PostToolUse", { tool: "Write", detail: "apps/daemon/src/hooks/receiver.ts" }),
    },
  },
  {
    id: 4,
    at: NOW - MIN,
    event: {
      type: "hook",
      payload: hook("PostToolUse", {
        tool: "mcp__kibo__ask_user",
        question: "Quel port pour le récepteur ? 4747 (défaut) ou dynamique ?",
      }),
    },
  },
  { id: 5, at: NOW, event: { type: "reranked", rank: 3 } },
  { id: 6, at: NOW, event: { type: "hook", payload: hook("Stop", { detail: "J'attends ta réponse." }) } },
  { id: 7, at: NOW, event: { type: "hook", payload: hook("SessionEnd", { detail: "other" }) } },
  {
    id: 8,
    at: NOW,
    event: { type: "exited", code: 0, isError: false, result: "ok", tokens: 1, costUsd: 0, denied: [] },
  },
];
