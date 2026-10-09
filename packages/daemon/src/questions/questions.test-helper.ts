import { Question, type RunView } from "@kibo/schema";

export const HUMAN = { kind: "human", ref: "adam" } as const;

export function runView(p: Partial<RunView> & Pick<RunView, "id">): RunView {
  return {
    seq: 1,
    projectId: "p1",
    ticketId: "t1",
    ticketKey: "KIB-14",
    ticketTitle: "Récepteur de hooks",
    profileId: "opus",
    profileName: "opus-dev",
    sessionId: `s-${p.id}`,
    brief: "",
    kind: "ticket",
    resumedFrom: null,
    createdAt: 1,
    label: "opus-dev",
    state: "done",
    lane: null,
    priority: false,
    rank: 0,
    question: null,
    pendingAnswer: null,
    lastActivity: null,
    subagents: [],
    workspace: null,
    cwd: null,
    guidelines: 0,
    transcriptPath: null,
    tokens: 0,
    costUsd: 0,
    denied: [],
    error: null,
    output: null,
    stateSince: 1,
    startedAt: 2,
    endedAt: null,
    turns: 1,
    activeMs: 0,
    turnStartedAt: null,
    session: null,
    ...p,
  };
}

export function answered(
  id: string,
  p: { at?: number; blocking?: boolean; runId?: string | null; text?: string } = {},
): Question {
  return Question.parse({
    id,
    ticketId: "t1",
    runId: p.runId === undefined ? "r1" : p.runId,
    title: `Question ${id}`,
    context: "",
    options: [],
    provisional: null,
    blocking: p.blocking ?? false,
    createdBy: { kind: "agent", ref: "opus-dev" },
    createdAt: 1,
    importRef: null,
    answer: { kind: "text", option: null, text: p.text ?? `Réponse ${id}`, by: HUMAN, at: p.at ?? 10 },
  });
}
