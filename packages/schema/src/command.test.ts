import { expect, test } from "bun:test";
import { COMMAND_WRITES, type CommandResult, isReservedCommand, ProjectCommand } from "./command";
import type { Question } from "./question";

test("the progress and recipient commands parse", () => {
  const commands = [
    {
      method: "setTicketProgress",
      ticketId: "t1",
      runId: "r1",
      at: 1,
      plan: [{ id: "a", title: "Lire", status: "doing" }],
      report: { done: "Fait." },
      check: { undeclared: ["a.ts"], unchanged: [] },
    },
    { method: "addQuestionRecipient", name: "Juridique" },
    { method: "renameQuestionRecipient", recipientId: "client", name: "Client final" },
    { method: "removeQuestionRecipient", recipientId: "client" },
    { method: "setQuestionRecipient", questionId: "q1", recipient: "product" },
    { method: "markQuestionSent", questionId: "q1" },
  ];
  for (const command of commands) expect(ProjectCommand.safeParse(command).success).toBe(true);
  expect(ProjectCommand.safeParse({ method: "addQuestionRecipient", name: "x".repeat(41) }).success).toBe(
    false,
  );
  expect(
    ProjectCommand.safeParse({ method: "setTicketProgress", ticketId: "t1", runId: "", at: 1 }).success,
  ).toBe(false);
});

test("the ticket progress is reserved to the daemon, recipients write questions", () => {
  expect(COMMAND_WRITES.setTicketProgress).toBeNull();
  expect(isReservedCommand("setTicketProgress")).toBe(true);
  expect(COMMAND_WRITES.addQuestionRecipient).toBe("question");
  expect(COMMAND_WRITES.renameQuestionRecipient).toBe("question");
  expect(COMMAND_WRITES.removeQuestionRecipient).toBe("question");
  expect(COMMAND_WRITES.setQuestionRecipient).toBe("question");
  expect(COMMAND_WRITES.markQuestionSent).toBe("question");
});

const QID = "11111111-1111-4111-8111-111111111111";
const ADAM = { kind: "human", ref: "adam" } as const;
const EDITS = [
  "updateQuestion",
  "updateAnswer",
  "reopenQuestion",
  "archiveQuestion",
  "restoreQuestion",
] as const;

test("the question edit commands parse, an update must change something", () => {
  const commands = [
    { method: "createQuestion", ticketId: "t1", title: "Q", createdBy: ADAM, recipient: "client" },
    { method: "updateQuestion", questionId: QID, by: ADAM, title: "B" },
    { method: "updateQuestion", questionId: QID, by: ADAM, provisional: null },
    { method: "updateAnswer", questionId: QID, answer: { kind: "text", text: "x" }, by: ADAM },
    { method: "reopenQuestion", questionId: QID, by: ADAM },
    { method: "archiveQuestion", questionId: QID, by: ADAM, at: 3 },
    { method: "restoreQuestion", questionId: QID, by: ADAM },
  ];
  for (const command of commands) expect(ProjectCommand.safeParse(command).success).toBe(true);
  expect(ProjectCommand.safeParse({ method: "updateQuestion", questionId: QID, by: ADAM }).success).toBe(
    false,
  );
  expect(
    ProjectCommand.safeParse({ method: "updateQuestion", questionId: QID, by: ADAM, blocking: true }).success,
  ).toBe(false);
  expect(ProjectCommand.safeParse({ method: "reopenQuestion", questionId: QID }).success).toBe(false);
});

test("the question edit commands write questions and return the question", () => {
  for (const method of EDITS) expect(COMMAND_WRITES[method]).toBe("question");
  const results: { [M in (typeof EDITS)[number]]: CommandResult[M] extends Question ? true : false } = {
    updateQuestion: true,
    updateAnswer: true,
    reopenQuestion: true,
    archiveQuestion: true,
    restoreQuestion: true,
  };
  expect(Object.keys(results)).toHaveLength(5);
});

test("the delivery step is a command reserved to the daemon", () => {
  expect(COMMAND_WRITES.setTicketDelivery).toBeNull();
  expect(isReservedCommand("setTicketDelivery")).toBe(true);
  const delivery = { step: 7, note: "", at: 1, runId: null };
  expect(ProjectCommand.safeParse({ method: "setTicketDelivery", ticketId: "t1", delivery }).success).toBe(
    true,
  );
  expect(
    ProjectCommand.safeParse({ method: "setTicketDelivery", ticketId: "t1", delivery: null }).success,
  ).toBe(true);
  expect(
    ProjectCommand.safeParse({
      method: "setTicketDelivery",
      ticketId: "t1",
      delivery: { ...delivery, step: 12 },
    }).success,
  ).toBe(false);
});

const SPRINT_COMMANDS = [
  { method: "createSprint", name: "Rapports", start: "2026-10-26", end: "2026-10-30" },
  { method: "updateSprint", sprintId: "s44", patch: { end: "2026-10-31" } },
  { method: "deleteSprint", sprintId: "s44" },
  { method: "setTicketSprint", ticketId: "f9", sprintId: "s44" },
  { method: "setTicketSprint", ticketId: "f9", sprintId: null },
  { method: "setTicketOptional", ticketId: "e93", optional: true },
] as const;

test("the sprint and optional step commands parse and validate their input", () => {
  for (const command of SPRINT_COMMANDS) expect(ProjectCommand.safeParse(command).success).toBe(true);
  const invalid = [
    { method: "createSprint", name: "Rapports", start: "2026-10-30", end: "2026-10-26" },
    { method: "createSprint", name: "", start: "2026-10-26", end: "2026-10-30" },
    { method: "updateSprint", sprintId: "s44", patch: { id: "x" } },
    { method: "setTicketSprint", ticketId: "f9" },
    { method: "setTicketOptional", ticketId: "e93" },
  ];
  for (const command of invalid) expect(ProjectCommand.safeParse(command).success).toBe(false);
});

test("sprint commands write sprints, assignment and optional steps write tickets", () => {
  expect(COMMAND_WRITES.createSprint).toBe("sprint");
  expect(COMMAND_WRITES.updateSprint).toBe("sprint");
  expect(COMMAND_WRITES.deleteSprint).toBe("sprint");
  expect(COMMAND_WRITES.setTicketSprint).toBe("ticket");
  expect(COMMAND_WRITES.setTicketOptional).toBe("ticket");
  for (const { method } of SPRINT_COMMANDS) expect(isReservedCommand(method)).toBe(false);
});

test("a ticket update may set or clear its short key, in the short key format", () => {
  expect(ProjectCommand.safeParse({ method: "updateTicket", ticketId: "f5", shortKey: "F5" }).success).toBe(
    true,
  );
  expect(ProjectCommand.safeParse({ method: "updateTicket", ticketId: "f5", shortKey: null }).success).toBe(
    true,
  );
  expect(ProjectCommand.safeParse({ method: "updateTicket", ticketId: "f5", shortKey: "f5" }).success).toBe(
    false,
  );
});
