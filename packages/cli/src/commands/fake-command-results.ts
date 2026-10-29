import {
  Link,
  type ProjectCommand,
  Question,
  Sprint,
  type SprintView,
  Ticket,
  type TicketView,
} from "@kibo/schema";
import { fakeTicket } from "./fake-ticket";

export type FakeState = { tickets: TicketView[]; sprints: SprintView[]; seq: number };
type Of<M extends ProjectCommand["method"]> = Extract<ProjectCommand, { method: M }>;

const FAKE_PREFIX = "SILO";
const FAKE_CREATED_AT = 1_793_000_000_000;

const nextSeq = (state: FakeState): number => {
  state.seq += 1;
  return state.seq;
};

function createdTicket(cmd: Of<"createTicket">, state: FakeState): Ticket {
  const n = nextSeq(state);
  const parent = state.tickets.find((t) => t.id === cmd.parentId);
  const view = fakeTicket({
    id: `t-${n}`,
    key: `${FAKE_PREFIX}-${100 + n}`,
    title: cmd.title,
    description: cmd.description,
    labels: cmd.labels,
    statusId: cmd.statusId,
    parentId: cmd.parentId ?? undefined,
    shortKey: cmd.feature === true ? `F${n}` : undefined,
    effectiveSprintId: parent?.sprintId ?? undefined,
  });
  state.tickets.push(view);
  return Ticket.parse(view);
}

function createdSprint(cmd: Of<"createSprint">, state: FakeState): Sprint {
  const id = `s-${nextSeq(state)}`;
  const sprint = Sprint.parse({ id, code: cmd.code, name: cmd.name, start: cmd.start, end: cmd.end });
  state.sprints.push({ ...sprint, state: "planned", features: [], delivered: 0, total: 0, lingering: false });
  return sprint;
}

function createdQuestion(cmd: Of<"createQuestion">, state: FakeState): Question {
  const n = nextSeq(state);
  return Question.parse({
    id: `q-${n}`,
    ticketId: cmd.ticketId,
    runId: cmd.runId ?? null,
    title: cmd.title,
    context: cmd.context ?? "",
    options: cmd.options ?? [],
    provisional: cmd.provisional ?? null,
    blocking: cmd.blocking ?? false,
    createdBy: cmd.createdBy,
    createdAt: FAKE_CREATED_AT + n,
    number: n,
    answer: null,
    recipient: cmd.recipient,
  });
}

export function fakeCommandResult(command: ProjectCommand, state: FakeState): unknown {
  switch (command.method) {
    case "createTicket":
      return createdTicket(command, state);
    case "createSprint":
      return createdSprint(command, state);
    case "createQuestion":
      return createdQuestion(command, state);
    case "addLink":
      return Link.parse({
        id: `l-${nextSeq(state)}`,
        from: command.from,
        to: command.to,
        type: command.type,
      });
    default:
      return {};
  }
}
