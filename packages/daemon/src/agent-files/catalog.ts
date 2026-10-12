import type { Agent, AgentRef } from "@kibo/schema";
import { type DiscoveredAgent, discoverAgents, type ProjectFolderRef } from "./discover";
import type { FileHistory } from "./file-history";
import type { AgentRoots } from "./paths";
import type { AgentSettingsStore } from "./settings-store";
import { type AgentWatch, agentWatchTargets, WATCH_LIMIT, type WatchPathsFn, watchAgentRoots } from "./watch";

export const AGENT_FILE = "agent.md";

export type AgentCatalog = {
  list(projectId: string | null): Agent[];
  byRef(ref: AgentRef): Agent | null;
  refresh(): Promise<void>;
  expect(hash: string): void;
  onChange(listener: () => void): () => void;
  partialWatch(): boolean;
  close(): void;
};

export type AgentCatalogInput = {
  roots: AgentRoots;
  projects(): ProjectFolderRef[];
  settings: AgentSettingsStore;
  activeRuns(ref: AgentRef): number;
  history: FileHistory;
  watch?: WatchPathsFn;
  watchLimit?: number;
};

const sameTargets = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((t, i) => t === b[i]);

export function createAgentCatalog(input: AgentCatalogInput): AgentCatalog {
  const { history, settings } = input;
  let discovered: DiscoveredAgent[] = [];
  let watcher: AgentWatch | null = null;
  let running: Promise<void> = Promise.resolve();
  let closed = false;
  const expected = new Set<string>();
  const listeners = new Set<() => void>();

  const toAgent = (d: DiscoveredAgent, shadowedBy: AgentRef | null): Agent => {
    const { content: _content, ...rest } = d;
    return { ...rest, settings: settings.get(d.ref), shadowedBy, activeRuns: input.activeRuns(d.ref) };
  };

  const shadowOf = (d: DiscoveredAgent, projectId: string | null): AgentRef | null => {
    if (d.scope !== "global") return null;
    const shadow = discovered.find(
      (p) => p.scope === "project" && p.name === d.name && (projectId === null || p.projectId === projectId),
    );
    return shadow?.ref ?? null;
  };

  const recordExternal = (d: DiscoveredAgent) => {
    if (d.content === null || d.hash === null) return;
    if (expected.delete(d.hash) || history.hasHash("agents", d.ref, AGENT_FILE, d.hash)) return;
    history.deposit({
      kind: "agents",
      ref: d.ref,
      file: AGENT_FILE,
      content: d.content,
      origin: "external",
      by: null,
      note: null,
    });
  };

  const onWatch = () => {
    void refresh()
      .then(() => {
        for (const listener of listeners) listener();
      })
      .catch((e: unknown) => console.error("[kibo-daemon] agent files refresh failed", e));
  };

  const rewatch = () => {
    if (closed) return;
    const projects = input.projects();
    const limit = input.watchLimit ?? WATCH_LIMIT;
    if (watcher && sameTargets(watcher.targets, agentWatchTargets(input.roots, projects).slice(0, limit)))
      return;
    watcher?.close();
    watcher = watchAgentRoots(input.roots, projects, onWatch, { watch: input.watch, limit });
  };

  const scan = async () => {
    const stale = [...expected];
    const found = await discoverAgents(input.roots, input.projects());
    for (const d of found) recordExternal(d);
    for (const hash of stale) expected.delete(hash);
    discovered = found;
    rewatch();
  };

  const refresh = (): Promise<void> => {
    const next = running.then(scan);
    running = next.catch(() => undefined);
    return next;
  };

  return {
    list: (projectId) =>
      discovered
        .filter((d) => projectId === null || d.projectId === null || d.projectId === projectId)
        .map((d) => toAgent(d, shadowOf(d, projectId))),
    byRef(ref) {
      const found = discovered.find((d) => d.ref === ref);
      return found ? toAgent(found, null) : null;
    },
    refresh,
    expect: (hash) => {
      expected.add(hash);
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    partialWatch: () => watcher?.partial ?? false,
    close() {
      closed = true;
      watcher?.close();
      watcher = null;
    },
  };
}
