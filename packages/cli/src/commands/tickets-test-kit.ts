import { tmpdir } from "node:os";
import {
  DEFAULT_WORKFLOW,
  type DeclareTicketRefResult,
  EMPTY_PROGRESS,
  type ExternalRef,
  type ProjectMeta,
  type ProjectSnapshot,
  type RpcRequest,
  type SprintView,
  type StatusId,
  type TicketView,
} from "@kibo/schema";
import type { DaemonClient } from "../daemon-client";

type TicketInput = {
  id: string;
  key: string;
  statusId?: StatusId;
  parentId?: string;
  sprintId?: string;
  effectiveSprintId?: string;
  shortKey?: string;
  optional?: boolean;
  children?: number;
  refs?: ExternalRef[];
};

export function fakeTicket(input: TicketInput): TicketView {
  return {
    id: input.id,
    key: input.key,
    pendingSeq: null,
    title: `Titre ${input.key}`,
    description: "",
    statusId: input.statusId ?? "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: input.parentId ?? null,
    externalRefs: input.refs ?? [],
    labels: [],
    agentProgress: EMPTY_PROGRESS,
    delivery: null,
    sprintId: input.sprintId ?? null,
    optional: input.optional ?? false,
    shortKey: input.shortKey ?? null,
    effectiveSprintId: input.effectiveSprintId ?? input.sprintId ?? null,
    session: null,
    updatedAt: null,
    feature: null,
    progress: { done: 0, total: input.children ?? 0 },
    waitingOn: [],
    keyLabel: input.key,
    openQuestions: 0,
    startable: true,
  };
}

const sprint = (
  id: string,
  [code, name]: [string, string],
  start: string,
  end: string,
  state: SprintView["state"],
) => ({
  id,
  code,
  name,
  start,
  end,
  state,
  delivered: 0,
  total: 0,
  lingering: false,
});

export const EMIS_META: ProjectMeta = {
  id: "p-emis",
  key: "EMIS",
  name: "Emis",
  folder: null,
  color: "#336699",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
};

export const SPRINTS: SprintView[] = [
  { ...sprint("s43", ["S43", "Import et soudures"], "2026-10-26", "2026-11-06", "planned"), features: [] },
  { ...sprint("s41", ["S41", "Accès"], "2026-09-28", "2026-10-09", "done"), features: [] },
  {
    ...sprint("s42", ["S42", "Terrain hors ligne"], "2026-10-12", "2026-10-23", "current"),
    features: ["f5"],
  },
];

export const TICKETS: TicketView[] = [
  fakeTicket({ id: "f5", key: "EMIS-30", shortKey: "F5", sprintId: "s42", children: 2 }),
  fakeTicket({ id: "a", key: "EMIS-33", parentId: "f5", effectiveSprintId: "s42" }),
  fakeTicket({ id: "b", key: "EMIS-34", parentId: "f5", effectiveSprintId: "s42", optional: true }),
  fakeTicket({ id: "f7", key: "EMIS-40", shortKey: "F7", children: 1 }),
  fakeTicket({ id: "c", key: "EMIS-41", parentId: "f7", statusId: "in_progress" }),
  fakeTicket({ id: "solo", key: "EMIS-50" }),
];

export function fakeSnapshot(
  tickets: TicketView[] = TICKETS,
  sprints: SprintView[] = SPRINTS,
): ProjectSnapshot {
  const partial = {
    meta: EMIS_META,
    workflow: DEFAULT_WORKFLOW,
    tickets,
    links: [],
    questions: [],
    questionRecipients: [],
    sprints,
  };
  return partial as never;
}

type Declare = Extract<RpcRequest, { method: "declareTicketRef" }>;
export type FakeDaemonOptions = {
  projects?: ProjectMeta[];
  declared?: (req: Declare, ticket: TicketView) => DeclareTicketRefResult;
};

const unchanged = (_req: Declare, ticket: TicketView): DeclareTicketRefResult => ({
  ticket,
  statusChanged: false,
});

export function fakeDaemon(
  tickets: TicketView[] = TICKETS,
  sprints: SprintView[] = SPRINTS,
  options: FakeDaemonOptions = {},
) {
  const calls: RpcRequest[] = [];
  const declared = options.declared ?? unchanged;
  const client: DaemonClient = {
    async rpc(req) {
      const sent: RpcRequest = req;
      calls.push(sent);
      if (sent.method === "listProjects") return (options.projects ?? [EMIS_META]) as never;
      if (sent.method === "getProject") return fakeSnapshot(tickets, sprints) as never;
      if (sent.method === "command") return {} as never;
      if (sent.method === "getNotesDir") return { dir: tmpdir() } as never;
      if (sent.method === "listNotes") return [] as never;
      if (sent.method === "declareTicketRef") {
        const ticket = tickets.find((t) => t.key === sent.ticketKey);
        if (!ticket) throw new Error(`unknown ${sent.ticketKey}`);
        return declared(sent, ticket) as never;
      }
      throw new Error(`unexpected ${sent.method}`);
    },
    async close() {},
  };
  const out: string[] = [];
  const err: string[] = [];
  const io = { home: tmpdir(), out: (l: string) => out.push(l), err: (l: string) => err.push(l) };
  const commands = () => calls.flatMap((c) => (c.method === "command" ? [c.command] : []));
  const declarations = () =>
    calls.flatMap((c) => (c.method === "declareTicketRef" ? [{ ticketKey: c.ticketKey, ref: c.ref }] : []));
  return { client, calls, commands, declarations, out, err, io, connect: async () => client };
}
