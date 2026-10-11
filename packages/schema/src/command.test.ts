import { expect, test } from "bun:test";
import { COMMAND_WRITES, isReservedCommand, ProjectCommand } from "./command";

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
