import type { SubagentLaunch } from "@kibo/core";
import {
  clipDescription,
  clipResult,
  clipType,
  denialOf,
  type HookPayload,
  linkedRow,
  type RunSubagent,
  type SubagentFacts,
  type SubagentRow,
} from "@kibo/schema";
import type { SubagentStore } from "./store";

export type SubagentMeta = {
  agentId: string;
  agentType: string | null;
  description: string | null;
  toolUseId: string | null;
  spawnDepth: number | null;
  model: string | null;
};
export type SubagentAnnounce = { kind: "subagent"; subagentId: string; type: string; description: string };
export type TrackerDeps = {
  store: SubagentStore;
  now: () => number;
  transcriptOf(runId: string, agentId: string): string | null;
  announce(runId: string, moment: SubagentAnnounce): void;
  changed?(runId: string): void;
};
export type SubagentTracker = {
  onHook(runId: string, payload: HookPayload): void;
  onLaunch(runId: string, launch: SubagentLaunch, parentId?: string | null): void;
  onMeta(runId: string, meta: SubagentMeta): void;
  onSlice(runId: string, subagentId: string, lines: readonly string[]): void;
  onResult(runId: string, toolUseId: string, isError: boolean, text: string | null): void;
  closeRun(runId: string): void;
  active(runId: string): RunSubagent[];
};

type PendingLaunch = { launch: SubagentLaunch; parentId: string | null };
type PendingResult = { isError: boolean; text: string | null };
type RunMemory = {
  launches: Map<string, PendingLaunch>;
  results: Map<string, PendingResult>;
  links: Map<string, string>;
  announced: Set<string>;
};

const ASYNC_LAUNCHED = /^Async agent launched/;

const launchFacts = ({ launch, parentId }: PendingLaunch): SubagentFacts => ({
  toolUseId: launch.toolUseId,
  type: launch.type,
  description: launch.description,
  prompt: launch.prompt,
  ...(launch.model === null ? {} : { model: launch.model }),
  ...(parentId === null ? {} : { parentId }),
});

function metaFacts(meta: SubagentMeta): SubagentFacts {
  const facts: SubagentFacts = {};
  if (meta.toolUseId !== null) facts.toolUseId = meta.toolUseId;
  if (meta.agentType !== null) facts.type = clipType(meta.agentType);
  if (meta.description !== null) facts.description = clipDescription(meta.description);
  if (meta.model !== null) facts.model = clipType(meta.model);
  return facts;
}

const isKnown = (value: string | null): boolean => value !== null && value !== "";

function newFacts(current: SubagentRow, facts: SubagentFacts): SubagentFacts {
  const added: SubagentFacts = {};
  for (const [key, value] of Object.entries(facts) as [keyof SubagentFacts, string | null | undefined][]) {
    if (value === undefined || !isKnown(value) || isKnown(current[key])) continue;
    Object.assign(added, { [key]: value });
  }
  return added;
}

export function createSubagentTracker(deps: TrackerDeps): SubagentTracker {
  const { store } = deps;
  const memory = new Map<string, RunMemory>();
  const memoryOf = (runId: string): RunMemory => {
    const found = memory.get(runId);
    if (found) return found;
    const created: RunMemory = {
      launches: new Map(),
      results: new Map(),
      links: new Map(),
      announced: new Set(),
    };
    memory.set(runId, created);
    return created;
  };

  function announce(runId: string, id: string): void {
    const s = store.find(id);
    const { announced } = memoryOf(runId);
    if (s === null || announced.has(id)) return;
    announced.add(id);
    deps.announce(runId, { kind: "subagent", subagentId: id, type: s.type, description: s.description });
  }

  function attach(runId: string, id: string, pending: PendingLaunch): void {
    link(id, launchFacts(pending));
    announce(runId, id);
  }

  function link(id: string, facts: SubagentFacts): void {
    const row = store.get(id);
    if (row === null) return;
    const current = linkedRow(row, store.events(id));
    const added = newFacts(current, facts);
    if (Object.keys(added).length === 0) return;
    store.append(id, { type: "linked", at: deps.now(), facts: added });
  }

  function ensure(runId: string, agentId: string, facts: SubagentFacts): void {
    if (store.get(agentId) === null) {
      store.create({
        id: agentId,
        runId,
        toolUseId: null,
        type: "",
        description: "",
        prompt: "",
        model: null,
        parentId: null,
        transcriptPath: deps.transcriptOf(runId, agentId),
        startedAt: deps.now(),
      });
      deps.changed?.(runId);
    }
    link(agentId, facts);
    adoptPending(runId, agentId);
  }

  function adoptPending(runId: string, agentId: string): void {
    const mem = memoryOf(runId);
    for (const [toolUseId, owner] of mem.links) {
      if (owner !== agentId) continue;
      const launch = mem.launches.get(toolUseId);
      if (launch) {
        mem.launches.delete(toolUseId);
        attach(runId, agentId, launch);
      }
      const result = mem.results.get(toolUseId);
      if (result) {
        mem.results.delete(toolUseId);
        end(runId, agentId, result.isError, result.text);
      }
    }
  }

  function started(runId: string, id: string): void {
    if (store.events(id).some((e) => e.type === "started")) return;
    store.append(id, { type: "started", at: deps.now() });
    deps.changed?.(runId);
  }

  function end(runId: string, id: string, isError: boolean, text: string | null): void {
    const result = text === null ? null : clipResult(text);
    const same = store
      .events(id)
      .some((e) => e.type === "ended" && e.isError === isError && e.result === result);
    if (same) return;
    store.append(id, { type: "ended", at: deps.now(), isError, result });
    deps.changed?.(runId);
  }

  const ownerOf = (runId: string, toolUseId: string): string | null =>
    memoryOf(runId).links.get(toolUseId) ?? store.byToolUse(runId, toolUseId);

  function fallbackRow(runId: string, toolUseId: string, pending: PendingLaunch): void {
    if (store.get(toolUseId) !== null) return;
    store.create({
      id: toolUseId,
      runId,
      toolUseId,
      type: pending.launch.type,
      description: pending.launch.description,
      prompt: pending.launch.prompt,
      model: pending.launch.model,
      parentId: pending.parentId,
      transcriptPath: null,
      startedAt: deps.now(),
    });
    announce(runId, toolUseId);
  }

  return {
    onHook(runId, payload) {
      if (payload.agentId === null) return;
      const type = payload.tool === null ? {} : { type: clipType(payload.tool) };
      if (payload.event === "SubagentStart") {
        ensure(runId, payload.agentId, type);
        started(runId, payload.agentId);
      }
      if (payload.event === "SubagentStop") {
        ensure(runId, payload.agentId, type);
        end(runId, payload.agentId, false, payload.detail);
      }
    },
    onLaunch(runId, launch, parentId = null) {
      const pending = { launch, parentId };
      const owner = ownerOf(runId, launch.toolUseId);
      if (owner === null) memoryOf(runId).launches.set(launch.toolUseId, pending);
      else attach(runId, owner, pending);
    },
    onMeta(runId, meta) {
      if (meta.toolUseId !== null) memoryOf(runId).links.set(meta.toolUseId, meta.agentId);
      ensure(runId, meta.agentId, metaFacts(meta));
    },
    onSlice(runId, subagentId, lines) {
      if (lines.every((l) => l.trim() === "")) return;
      ensure(runId, subagentId, {});
      started(runId, subagentId);
    },
    onResult(runId, toolUseId, isError, text) {
      if (!isError && ASYNC_LAUNCHED.test(text ?? "")) return;
      const owner = ownerOf(runId, toolUseId);
      if (owner === null && isError && denialOf(text)) memoryOf(runId).launches.delete(toolUseId);
      else if (owner !== null) end(runId, owner, isError, text);
      else if (memoryOf(runId).launches.has(toolUseId))
        memoryOf(runId).results.set(toolUseId, { isError, text });
    },
    closeRun(runId) {
      const mem = memory.get(runId);
      if (!mem) return;
      for (const [toolUseId, pending] of mem.launches) {
        fallbackRow(runId, toolUseId, pending);
        const result = mem.results.get(toolUseId);
        if (result) end(runId, toolUseId, result.isError, result.text);
      }
      memory.delete(runId);
    },
    active: (runId) => store.list(runId).filter((s) => s.state === "running"),
  };
}
