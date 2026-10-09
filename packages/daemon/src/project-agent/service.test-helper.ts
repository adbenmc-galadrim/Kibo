import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFILES, PROJECT_ID, project, run, ticket } from "@kibo/core/project-agent/test-kit";
import {
  type ActionResult,
  type AgentsState,
  KiboError,
  type ProjectSnapshot,
  type RunView,
} from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import { createProjectAgentService, type ProjectAgentAgents, type ProjectAgentService } from "./service";
import { openProjectAgentStore, type ProjectAgentStore } from "./store";
import type { ProjectAgentDataPort, ProjectAgentOps } from "./types";

export { PROJECT_ID };
export const GOOD_TOKEN = "a".repeat(64);

const HOST: AgentsState["host"] = {
  hostSlots: 1,
  cpuThreshold: 85,
  ramThreshold: 90,
  paused: false,
  autoSlots: 1,
  slotsFixed: false,
  cores: 8,
  ramGb: 16,
  used: 0,
  cpu: 0,
  ram: 0,
};

export type Kit = {
  svc: ProjectAgentService;
  store: ProjectAgentStore;
  calls: string[];
  notices: Notice[];
  emits: () => number;
  runs: Map<string, RunView>;
  notes: Map<string, string>;
  dir: string;
  setProject(next: ProjectSnapshot): void;
  current(): ProjectSnapshot;
  setWritable(writable: boolean): void;
  setFolder(folder: string | null): void;
  setApply(apply: ProjectAgentOps["apply"]): void;
  cleanup(): void;
};

function fakeAgents(runs: Map<string, RunView>, calls: string[]): ProjectAgentAgents {
  const update = (id: string, patch: Partial<RunView>): RunView => {
    const current = runs.get(id);
    if (!current) throw new KiboError("NOT_FOUND", `run ${id} not found`);
    const next = { ...current, ...patch };
    runs.set(id, next);
    return next;
  };
  const refuse = (name: string) => () => {
    throw new KiboError("INTERNAL", `${name} is not faked`);
  };
  return {
    startProjectRun(input) {
      calls.push(`start:${input.projectName}:${input.text}`);
      const view = run({
        id: crypto.randomUUID(),
        kind: "project",
        projectId: input.projectId,
        label: `Agent de projet · ${input.projectName}`,
        pendingAnswer: input.text,
      });
      runs.set(view.id, view);
      return view;
    },
    answer(runId, text) {
      calls.push(`answer:${runId}:${text}`);
      return update(runId, { pendingAnswer: text, state: "queued" });
    },
    cancel(runId) {
      calls.push(`cancel:${runId}`);
      return update(runId, { state: "cancelled" });
    },
    assign: refuse("assign"),
    deliverAnswers: refuse("deliverAnswers"),
    log: () => [],
    state: () => ({
      runs: [...runs.values()],
      queue: [],
      host: HOST,
      tokensToday: 0,
      resumable: [],
      questions: [],
      projectAgents: [],
    }),
    hooks: { verify: (_runId, token) => token === GOOD_TOKEN, receive: () => null },
  };
}

const applyAll: ProjectAgentOps["apply"] = async (batch, chosen) =>
  batch.actions.map(
    (a): ActionResult => ({
      actionId: a.id,
      outcome: chosen.has(a.id) ? "applied" : "skipped",
      detail: null,
      created: null,
    }),
  );

export function serviceKit(): Kit {
  const dir = mkdtempSync(join(tmpdir(), "kibo-pa-svc-"));
  const store = openProjectAgentStore(dir);
  let snapshot = project({
    tickets: [
      ticket({ id: "t1", key: "EMIS-1", title: "Accueil" }),
      ticket({ id: "t11", key: "EMIS-11", title: "Panneau", statusId: "in_progress" }),
    ],
  });
  let writable = true;
  let folder: string | null = null;
  let apply = applyAll;
  let clock = 100;
  let emitted = 0;
  const calls: string[] = [];
  const notices: Notice[] = [];
  const runs = new Map<string, RunView>();
  const notes = new Map<string, string>();
  const data: ProjectAgentDataPort = {
    project(projectId) {
      if (projectId !== PROJECT_ID) throw new KiboError("NOT_FOUND", `project ${projectId} not found`);
      return snapshot;
    },
    projectName: () => snapshot.meta.name,
    projectFolder: () => folder,
    assertWritable() {
      if (!writable) throw new KiboError("FORBIDDEN", "read only");
    },
    viewer: () => "adam",
    profiles: () => PROFILES,
    guidelines: () => [],
    isDemoProject: () => false,
    notes: async () => [...notes].map(([path, content]) => ({ path, title: path, hash: `h:${content}` })),
    readNote: async (_projectId, path) => notes.get(path) ?? null,
    async writeNote(_projectId, path, content, mode) {
      calls.push(`note:${mode}:${path}`);
      notes.set(path, content);
    },
    runCommand() {
      throw new KiboError("INTERNAL", "runCommand is not faked");
    },
  };
  const agents = fakeAgents(runs, calls);
  const svc = createProjectAgentService({
    store,
    data,
    agents: () => agents,
    ops: {
      tool: async (target, tool) => `${tool}:${target.id}`,
      apply: (batch, chosen, by) => {
        calls.push(`apply:${[...chosen].join(",")}:${by.ref}`);
        return apply(batch, chosen, by);
      },
    },
    notify: (notice) => notices.push(notice),
    emit: () => {
      emitted += 1;
    },
    now: () => {
      clock += 1;
      return clock;
    },
  });
  return {
    svc,
    store,
    calls,
    notices,
    emits: () => emitted,
    runs,
    notes,
    dir,
    setProject: (next) => {
      snapshot = next;
    },
    current: () => snapshot,
    setWritable: (next) => {
      writable = next;
    },
    setFolder: (next) => {
      folder = next;
    },
    setApply: (next) => {
      apply = next;
    },
    cleanup() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
