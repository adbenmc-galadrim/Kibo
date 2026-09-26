import {
  ASK_TOOL,
  type HookPayload,
  isTerminal,
  KiboError,
  type RunEvent,
  type RunRecord,
  type RunState,
  type RunView,
} from "@kibo/schema";

type ExitEvent = Extract<RunEvent, { type: "exited" }>;

export function runLabel(profileName: string, lane: number | null): string {
  return lane === null ? profileName : `${profileName}-${lane}`;
}

export function initRun(record: RunRecord, rank: number, at: number): RunView {
  return {
    ...record,
    label: record.profileName,
    state: "queued",
    lane: null,
    priority: false,
    rank,
    question: null,
    pendingAnswer: null,
    lastActivity: null,
    subagents: [],
    workspace: null,
    guidelines: 0,
    transcriptPath: null,
    tokens: 0,
    costUsd: 0,
    denied: [],
    error: null,
    output: null,
    stateSince: at,
    startedAt: null,
    endedAt: null,
    turns: 0,
  };
}

function refuse(view: RunView, event: RunEvent): never {
  throw new KiboError("INVALID_TRANSITION", `${event.type} is not allowed when the run is ${view.state}`);
}

function requireState(view: RunView, event: RunEvent, allowed: RunState[]): void {
  if (!allowed.includes(view.state)) refuse(view, event);
}

function enter(view: RunView, state: RunState, at: number, patch: Partial<RunView> = {}): RunView {
  const next = { ...view, ...patch, state, stateSince: at };
  return {
    ...next,
    label: runLabel(next.profileName, next.lane),
    endedAt: isTerminal(state) ? at : next.endedAt,
  };
}

function applyHook(view: RunView, p: HookPayload, at: number): RunView {
  const next: RunView = {
    ...view,
    lastActivity: { at, event: p.event, tool: p.tool, detail: p.detail },
    transcriptPath: p.transcriptPath ?? view.transcriptPath,
  };
  if (view.state !== "running") return next;
  if (p.event === "PostToolUse" && p.tool === ASK_TOOL && p.question)
    return { ...next, question: p.question };
  if (p.event === "SubagentStart" && p.agentId) {
    const others = next.subagents.filter((s) => s.id !== p.agentId);
    return { ...next, subagents: [...others, { id: p.agentId, type: p.tool ?? "subagent", since: at }] };
  }
  if (p.event === "SubagentStop" && p.agentId) {
    return { ...next, subagents: next.subagents.filter((s) => s.id !== p.agentId) };
  }
  return next;
}

function applyExit(view: RunView, e: ExitEvent, at: number): RunView {
  const totals = {
    tokens: view.tokens + e.tokens,
    costUsd: view.costUsd + e.costUsd,
    denied: [...view.denied, ...e.denied],
    output: e.output ?? view.output,
    subagents: [],
  };
  if (view.state !== "running" && view.state !== "starting") {
    if (isTerminal(view.state)) return { ...view, ...totals };
    refuse(view, e);
  }
  const clean = e.code === 0 && !e.isError;
  if (clean && view.question !== null) return enter(view, "waiting_input", at, totals);
  if (clean) return enter(view, "done", at, totals);
  return enter(view, "failed", at, { ...totals, error: e.result ?? `exit code ${e.code}` });
}

export function reduceRun(view: RunView, event: RunEvent, at: number): RunView {
  switch (event.type) {
    case "enqueued":
      return refuse(view, event);
    case "admitted":
      requireState(view, event, ["queued"]);
      return enter(view, "starting", at, { lane: event.lane });
    case "spawned":
      requireState(view, event, ["starting"]);
      return enter(view, "running", at, {
        workspace: event.workspace,
        guidelines: event.guidelines,
        startedAt: view.startedAt ?? at,
        pendingAnswer: null,
        turns: view.turns + 1,
      });
    case "hook":
      return applyHook(view, event.payload, at);
    case "exited":
      return applyExit(view, event, at);
    case "answered":
      requireState(view, event, ["waiting_input"]);
      return enter(view, "queued", at, {
        lane: null,
        question: null,
        pendingAnswer: event.text,
        priority: true,
        rank: event.rank,
      });
    case "cancelled":
      if (isTerminal(view.state)) refuse(view, event);
      return enter(view, "cancelled", at, { subagents: [] });
    case "failed":
      if (isTerminal(view.state)) refuse(view, event);
      return enter(view, "failed", at, { error: event.error, subagents: [] });
    case "reranked":
      requireState(view, event, ["queued"]);
      return { ...view, rank: event.rank };
    case "prioritized":
      requireState(view, event, ["queued"]);
      return { ...view, priority: event.priority };
  }
}
