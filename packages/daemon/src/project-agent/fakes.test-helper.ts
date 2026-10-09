import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BatchContext, renderProblems, validateBatch } from "@kibo/core/project-agent/validate";
import {
  type AgentProfile,
  type AgentsState,
  type Batch,
  type DeliveryResult,
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
  type ProposedAction,
  Question,
  type QueueEntry,
  type RunView,
  type StatusId,
  Ticket,
} from "@kibo/schema";
import type { AssignInput } from "../agents/orchestrator-types";
import { ensureNotesTables } from "../notes/index";
import { createNotesService, type NotesService } from "../notes/service";
import { runView } from "../questions/questions.test-helper";
import { call, createService, type Service } from "../service";
import { openStore } from "../store";
import { createProjectAgentDataPort } from "./data-port";
import type { ProjectAgentAgentsPort, ProjectAgentDataPort } from "./types";

export const HUMAN = { kind: "human", ref: "adam" } as const;

export const PROFILES: AgentProfile[] = [
  {
    id: "opus",
    name: "opus-dev",
    model: "opus",
    execution: "cli",
    permissionMode: "acceptEdits",
    workspace: "isolated",
    maxParallel: 2,
    subagents: [],
    enabled: true,
    allow: [],
    system: false,
  },
  {
    id: "assistant",
    name: "assistant",
    model: "sonnet",
    execution: "cli",
    permissionMode: "default",
    workspace: "isolated",
    maxParallel: 1,
    subagents: [],
    enabled: true,
    allow: [],
    system: true,
  },
];

export type FakeAgents = ProjectAgentAgentsPort & {
  runs: RunView[];
  queue: QueueEntry[];
  assigned: AssignInput[];
  cancelled: string[];
  delivered: { projectId: string; ticketId: string }[];
  failAssign: KiboError | null;
};

const HOST = {
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

export function fakeAgents(): FakeAgents {
  const unused = (): never => {
    throw new Error("not used");
  };
  const fake: FakeAgents = {
    runs: [],
    queue: [],
    assigned: [],
    cancelled: [],
    delivered: [],
    failAssign: null,
    startProjectRun: unused,
    answer: unused,
    log: unused,
    state: (): AgentsState => ({
      runs: fake.runs,
      queue: fake.queue,
      host: HOST,
      tokensToday: 0,
      resumable: [],
      questions: [],
      projectAgents: [],
    }),
    assign(input) {
      if (fake.failAssign) throw fake.failAssign;
      fake.assigned.push(input);
      return runView({
        id: `run-${fake.assigned.length}`,
        projectId: input.projectId,
        ticketId: input.ticketId,
      });
    },
    cancel(runId) {
      fake.cancelled.push(runId);
      return runView({ id: runId, state: "cancelled" });
    },
    deliverAnswers(projectId, ticketId): DeliveryResult {
      fake.delivered.push({ projectId, ticketId });
      return { sent: 1, runId: null };
    },
  };
  return fake;
}

export type Harness = {
  dir: string;
  service: Service;
  notes: NotesService;
  data: ProjectAgentDataPort;
  agents: FakeAgents;
  project: ProjectMeta;
  commands: ProjectCommand[];
  projectReads: () => number;
  ticket(title: string, statusId?: StatusId): Ticket;
  command(command: ProjectCommand): unknown;
  createProject(name: string, key: string): ProjectMeta;
  close(): void;
};

export function harness(): Harness {
  const dir = mkdtempSync(join(tmpdir(), "kibo-project-agent-"));
  const store = openStore(dir);
  ensureNotesTables(store.db);
  const service = createService(store, { user: "adam" });
  const notes = createNotesService({
    db: store.db,
    home: dir,
    project: (id) => {
      const meta = service.docs.projectMeta(id);
      return { id: meta.id, key: meta.key, folder: meta.folder };
    },
    watch: () => ({ close: () => undefined }),
  });
  const real = createProjectAgentDataPort({
    docs: service.docs,
    notes,
    settings: { get: () => null },
    profiles: () => PROFILES,
    guidelines: () => [],
  });
  const commands: ProjectCommand[] = [];
  let reads = 0;
  const data: ProjectAgentDataPort = {
    ...real,
    project(projectId) {
      reads += 1;
      return real.project(projectId);
    },
    runCommand(projectId, command) {
      commands.push(command);
      return real.runCommand(projectId, command);
    },
  };
  const createProject = (name: string, key: string): ProjectMeta =>
    call(service, { method: "createProject", name, key, folder: null, color: "#F97316" });
  const project = createProject("Emis", "EMIS");
  const command = (cmd: ProjectCommand) =>
    call(service, { method: "command", projectId: project.id, command: cmd });
  return {
    dir,
    service,
    notes,
    data,
    agents: fakeAgents(),
    project,
    commands,
    projectReads: () => reads,
    ticket: (title, statusId = "todo") => Ticket.parse(command({ method: "createTicket", title, statusId })),
    command,
    createProject,
    close() {
      notes.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export const readOnly = (h: Harness): (() => void) =>
  h.service.docs.setWriteGuard((projectId) => {
    if (projectId === h.project.id) throw new KiboError("FORBIDDEN", "project is read-only");
  });

export async function contextOf(h: Harness): Promise<BatchContext> {
  const notes = await h.data.notes(h.project.id);
  return {
    project: h.data.project(h.project.id),
    runs: h.agents.state().runs,
    notes: notes.map((n) => ({ path: n.path, hash: n.hash })),
    profiles: PROFILES,
    demoProject: false,
    viewer: "adam",
  };
}

export async function propose(h: Harness, actions: ProposedAction[]): Promise<Batch> {
  const checked = validateBatch({ summary: "Ranger le projet", actions }, await contextOf(h));
  if (!checked.ok) throw new Error(renderProblems(checked.problems));
  return {
    id: "b1",
    projectId: h.project.id,
    runId: "p-run",
    sessionId: "s1",
    seq: 1,
    summary: "Ranger le projet",
    actions: checked.batch.actions,
    expected: checked.batch.expected,
    createdAt: 1,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    chosen: null,
    comment: null,
    results: [],
  };
}

export type Seeded = { tickets: Ticket[]; open: Question; undelivered: Question; runId: string };

export async function seed(h: Harness, count = 9): Promise<Seeded> {
  const tickets = Array.from({ length: count }, (_, i) => h.ticket(`Ticket ${i + 1}`));
  const ask = (ticketId: string, title: string) =>
    Question.parse(h.command({ method: "createQuestion", ticketId, title, createdBy: HUMAN, runId: null }));
  const at = (i: number): Ticket => {
    const t = tickets[i];
    if (!t) throw new Error(`no ticket ${i}`);
    return t;
  };
  const open = ask(at(0).id, "Quel port ?");
  const undelivered = ask(at(Math.min(5, count - 1)).id, "Quel format ?");
  h.command({
    method: "answerQuestion",
    questionId: undelivered.id,
    answer: { kind: "text", text: "JSON" },
    by: HUMAN,
  });
  await h.data.writeNote(h.project.id, "a.md", "# A\n", "create");
  h.agents.runs.push(
    runView({
      id: "r1",
      projectId: h.project.id,
      ticketId: at(1).id,
      ticketKey: at(1).key,
      state: "running",
    }),
  );
  return { tickets, open, undelivered, runId: "r1" };
}

export const titleOf = (h: Harness, key: string): string | undefined =>
  h.data.project(h.project.id).tickets.find((t) => t.key === key)?.title;
export const statusOf = (h: Harness, key: string): string | undefined =>
  h.data.project(h.project.id).tickets.find((t) => t.key === key)?.statusId;
