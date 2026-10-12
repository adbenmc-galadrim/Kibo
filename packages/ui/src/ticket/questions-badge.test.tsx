import { expect, mock, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type Question } from "@kibo/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionsBadge } from "./QuestionsBadge";

const TICKET = { id: "t1", keyLabel: "KIB-14", title: "Récepteur de hooks" };

const question = (id: string, createdAt: number): Question => ({
  id,
  ticketId: TICKET.id,
  runId: null,
  title: `Titre ${id}`,
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt,
  importRef: null,
  answer: null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
});

const badge = (count: number, questions: Question[], onOpen = mock((_id: string | null) => {})) => (
  <QuestionsBadge
    count={count}
    questions={questions}
    recipients={DEFAULT_RECIPIENTS}
    ticket={TICKET}
    runLabel={(id) => id}
    onOpen={onOpen}
  />
);

test("the badge counts open questions in orange and opens the first one", async () => {
  const onOpen = mock((_id: string | null) => {});
  const { rerender, container } = render(badge(1, [question("q2", 2), question("q1", 1)], onOpen));
  const one = screen.getByRole("button", { name: "1 question" });
  expect(one.getAttribute("title")).toBe("Ouvrir les questions");
  expect(one.className).toContain("text-orange-600");
  expect(one.className).toContain("dark:text-orange-400");
  expect(one.querySelector("svg")).toBeTruthy();
  await userEvent.setup().click(one);
  expect(onOpen).toHaveBeenCalledWith("q1");
  rerender(badge(2, [], onOpen));
  expect(screen.getByRole("button", { name: "2 questions" })).toBeTruthy();
  rerender(badge(0, [], onOpen));
  expect(container.childElementCount).toBe(0);
});

test("without an open question the badge opens the view as it is, and previews on focus", async () => {
  const onOpen = mock((_id: string | null) => {});
  const { rerender } = render(badge(1, [], onOpen));
  await userEvent.setup().click(screen.getByRole("button", { name: "1 question" }));
  expect(onOpen).toHaveBeenCalledWith(null);
  rerender(badge(1, [question("q1", 1)], onOpen));
  fireEvent.focus(screen.getByRole("button", { name: "1 question" }));
  expect(await screen.findByText("Titre q1")).toBeTruthy();
});
