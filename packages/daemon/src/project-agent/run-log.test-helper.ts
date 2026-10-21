import type { RunLogEntry } from "@kibo/schema";

export const answered = (id: number, text: string): RunLogEntry => ({
  id,
  at: id,
  event: { type: "answered", text, rank: 0 },
});

export const exited = (id: number, result: string | null, code = 0): RunLogEntry => ({
  id,
  at: id,
  event: { type: "exited", code, isError: code !== 0, result, tokens: 1, costUsd: 0, denied: [] },
});

export const asked = (id: number, tool: string, question: string | null): RunLogEntry => ({
  id,
  at: id,
  event: {
    type: "hook",
    payload: {
      event: "PostToolUse",
      sessionId: "s",
      transcriptPath: null,
      tool,
      detail: null,
      question,
      agentId: null,
      toolUseId: null,
      ask: null,
      todos: null,
      stopHookActive: false,
    },
  },
});
