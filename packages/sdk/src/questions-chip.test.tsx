import { expect, mock, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type Question } from "@kibo/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { QuestionsChip } from "./questions-chip";

const TICKET = { id: "t1", keyLabel: "KIB-14", title: "Corriger le formulaire" };

const question = (id: string, createdAt: number, answered = false): Question => ({
  id,
  ticketId: TICKET.id,
  runId: null,
  title: id,
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt,
  importRef: null,
  answer: answered
    ? {
        kind: "text",
        option: null,
        text: "Oui",
        by: { kind: "human", ref: "adam" },
        at: 1,
        deliveredAt: null,
        deliveredRunId: null,
      }
    : null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
});

function mount(questions: Question[]) {
  const onOpen = mock((_id: string | null) => {});
  const parent = { click: mock(() => {}), pointer: mock(() => {}), key: mock(() => {}) };
  render(
    createElement(
      "div",
      { onClick: parent.click, onPointerDown: parent.pointer, onKeyDown: parent.key },
      <QuestionsChip
        text="2 questions"
        label="2 questions, ouvrir"
        questions={questions}
        recipients={DEFAULT_RECIPIENTS}
        ticket={TICKET}
        runLabel={(id) => id}
        onOpen={onOpen}
      />,
    ),
  );
  return { onOpen, parent, chip: screen.getByRole("button", { name: "2 questions, ouvrir" }) };
}

test("the chip opens the first open question of the ticket, without reaching the card", () => {
  const { onOpen, parent, chip } = mount([question("old", 1, true), question("b", 3), question("a", 2)]);
  fireEvent.pointerDown(chip);
  fireEvent.keyDown(chip, { key: "Enter" });
  fireEvent.click(chip);
  expect(onOpen).toHaveBeenCalledWith("a");
  expect(parent.click).not.toHaveBeenCalled();
  expect(parent.pointer).not.toHaveBeenCalled();
  expect(parent.key).not.toHaveBeenCalled();
  expect(chip.textContent).toBe("2 questions");
});

test("without an open question the chip opens the view as it is", () => {
  const { onOpen, chip } = mount([question("old", 1, true)]);
  fireEvent.click(chip);
  expect(onOpen).toHaveBeenCalledWith(null);
});
