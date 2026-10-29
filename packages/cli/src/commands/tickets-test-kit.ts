import { tmpdir } from "node:os";
import {
  DEFAULT_WORKFLOW,
  type DeclareTicketRefResult,
  type ProjectCommand,
  type ProjectMeta,
  type ProjectSnapshot,
  type RpcRequest,
  type SprintView,
  type TicketView,
} from "@kibo/schema";
import type { DaemonClient } from "../daemon-client";
import { type FakeState, fakeCommandResult } from "./fake-command-results";
import { fakeTicket } from "./fake-ticket";

export { fakeTicket };

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

export const SILO_META: ProjectMeta = {
  id: "p-silo",
  key: "SILO",
  name: "Silo",
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
  { ...sprint("s43", ["S43", "Import et contrats"], "2026-10-26", "2026-11-06", "planned"), features: [] },
  { ...sprint("s41", ["S41", "Accès"], "2026-09-28", "2026-10-09", "done"), features: [] },
  {
    ...sprint("s42", ["S42", "Saisie hors ligne"], "2026-10-12", "2026-10-23", "current"),
    features: ["f5"],
  },
];

export const TICKETS: TicketView[] = [
  fakeTicket({ id: "f5", key: "SILO-30", shortKey: "F5", sprintId: "s42", children: 2 }),
  fakeTicket({ id: "a", key: "SILO-33", parentId: "f5", effectiveSprintId: "s42" }),
  fakeTicket({ id: "b", key: "SILO-34", parentId: "f5", effectiveSprintId: "s42", optional: true }),
  fakeTicket({ id: "f7", key: "SILO-40", shortKey: "F7", children: 1 }),
  fakeTicket({ id: "c", key: "SILO-41", parentId: "f7", statusId: "in_progress" }),
  fakeTicket({ id: "solo", key: "SILO-50" }),
];

export function fakeSnapshot(
  tickets: TicketView[] = TICKETS,
  sprints: SprintView[] = SPRINTS,
): ProjectSnapshot {
  const partial = {
    meta: SILO_META,
    workflow: DEFAULT_WORKFLOW,
    tickets,
    links: [],
    questions: [],
    questionRecipients: [],
    sprints,
    viewer: "u-me",
  };
  return partial as never;
}

type Declare = Extract<RpcRequest, { method: "declareTicketRef" }>;
export type FakeDaemonOptions = {
  projects?: ProjectMeta[];
  declared?: (req: Declare, ticket: TicketView) => DeclareTicketRefResult;
  raw?(body: Record<string, unknown>): unknown;
  onCommand?(command: ProjectCommand): unknown;
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
  const state: FakeState = { tickets: [...tickets], sprints: [...sprints], seq: 0 };
  const calls: RpcRequest[] = [];
  const raws: Record<string, unknown>[] = [];
  let closes = 0;
  const declared = options.declared ?? unchanged;
  const client: DaemonClient = {
    async rpc(req) {
      const sent: RpcRequest = req;
      calls.push(sent);
      if (sent.method === "listProjects") return (options.projects ?? [SILO_META]) as never;
      if (sent.method === "getProject") return fakeSnapshot([...state.tickets], [...state.sprints]) as never;
      if (sent.method === "command")
        return (options.onCommand?.(sent.command) ?? fakeCommandResult(sent.command, state)) as never;
      if (sent.method === "getNotesDir") return { dir: tmpdir() } as never;
      if (sent.method === "listNotes") return [] as never;
      if (sent.method === "declareTicketRef") {
        const ticket = state.tickets.find((t) => t.key === sent.ticketKey);
        if (!ticket) throw new Error(`unknown ${sent.ticketKey}`);
        return declared(sent, ticket) as never;
      }
      throw new Error(`unexpected ${sent.method}`);
    },
    async raw(body) {
      raws.push(body);
      if (!options.raw) throw new Error("unexpected raw");
      return options.raw(body);
    },
    async close() {
      closes += 1;
    },
  };
  const out: string[] = [];
  const err: string[] = [];
  const io = { home: tmpdir(), out: (l: string) => out.push(l), err: (l: string) => err.push(l) };
  const commands = () => calls.flatMap((c) => (c.method === "command" ? [c.command] : []));
  const declarations = () =>
    calls.flatMap((c) => (c.method === "declareTicketRef" ? [{ ticketKey: c.ticketKey, ref: c.ref }] : []));
  const closed = () => closes;
  return { client, calls, raws, closed, commands, declarations, out, err, io, connect: async () => client };
}
