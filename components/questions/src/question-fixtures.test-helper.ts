import {
  EMPTY_PROGRESS,
  type ProjectCommand,
  type Question,
  Sprint,
  Ticket,
  type TicketView,
} from "@kibo/schema";

export const question = (over: Partial<Question>): Question => ({
  kind: "question",
  images: [],
  id: "11111111-1111-4111-8111-111111111111",
  ticketId: "22222222-2222-4222-8222-222222222222",
  runId: null,
  title: "Un box réaffecté garde-t-il ses photos ?",
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: 1,
  number: null,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...over,
});

export const answer = (at: number): Question["answer"] => ({
  kind: "text",
  text: "Oui",
  option: null,
  by: { kind: "human", ref: "adam" },
  at,
  deliveredAt: null,
  deliveredRunId: null,
});

export const ticket = (id: string, keyLabel: string, over: Partial<TicketView> = {}): TicketView => ({
  id,
  key: keyLabel,
  hold: null,
  keyLabel,
  title: `Ticket ${keyLabel}`,
  description: "",
  statusId: "todo",
  parentId: null,
  assignee: null,
  domainId: null,
  blockedReason: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
  ...over,
});

export const ADAM = { kind: "human", ref: "adam" } as const;
export const Q14 = "Un box réaffecté garde-t-il ses photos ?";
export const Q17 = "Un rapport par chef de centre ou par client ?";
export const Q16 = "Quota par client : 2 Go ou 5 Go ?";

export const seedSilo = (run: (cmd: ProjectCommand) => unknown) => {
  const s43 = Sprint.parse(
    run({ method: "createSprint", code: "S43", name: "Sprint 43", start: "2026-10-19", end: "2026-10-23" }),
  );
  const f6 = Ticket.parse(run({ method: "createTicket", title: "Constats", feature: true }));
  run({ method: "setTicketSprint", ticketId: f6.id, sprintId: s43.id });
  const step = Ticket.parse(
    run({ method: "createTicket", title: "Lecture du fichier Excel", parentId: f6.id }),
  );
  const other = Ticket.parse(run({ method: "createTicket", title: "Modèle du rapport" }));
  run({ method: "createQuestion", ticketId: other.id, title: Q17, recipient: "client", createdBy: ADAM });
  run({ method: "createQuestion", ticketId: other.id, title: Q16, recipient: "product", createdBy: ADAM });
  run({
    method: "createQuestion",
    ticketId: step.id,
    title: Q14,
    blocking: true,
    recipient: "client",
    createdBy: ADAM,
  });
};
