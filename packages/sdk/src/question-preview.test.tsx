import { afterEach, beforeAll, beforeEach, expect, jest, mock, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type Question } from "@kibo/schema";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { QuestionPreview, type QuestionPreviewProps } from "./question-preview";

const TICKET = { id: "t1", keyLabel: "KIB-14", title: "Corriger le formulaire" };

const question = (n: number, over: Partial<Question> = {}): Question => ({
  kind: "question",
  images: [],
  id: `q${n}`,
  ticketId: TICKET.id,
  runId: null,
  title: `Question ${n} ?`,
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt: n,
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

const realMatchMedia = window.matchMedia;

beforeAll(async () => {
  await import("./question-preview-content");
});
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  window.matchMedia = realMatchMedia;
});

async function settle(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

function mount(over: Partial<QuestionPreviewProps> = {}) {
  const onOpen = mock((_id: string) => {});
  const parent = mock(() => {});
  render(
    createElement(
      "div",
      { onClick: parent },
      <QuestionPreview
        mode="ticket"
        questions={[question(1), question(2)]}
        recipients={DEFAULT_RECIPIENTS}
        ticket={TICKET}
        runLabel={(id) => id}
        onOpen={onOpen}
        {...over}
      >
        <button type="button">2 questions</button>
      </QuestionPreview>,
    ),
  );
  return { onOpen, parent, trigger: screen.getByRole("button", { name: "2 questions" }) };
}

test("hovering 299 ms shows nothing, 300 ms shows the open questions", async () => {
  const { trigger } = mount();
  fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
  await settle(299);
  expect(screen.queryByText("Question 1 ?")).toBeNull();
  await settle(1);
  await settle(0);
  expect(screen.getByText("Question 1 ?")).toBeTruthy();
  expect(screen.getByText("Question 2 ?")).toBeTruthy();
});

test("keyboard focus opens at once, Escape closes", async () => {
  const { trigger } = mount();
  fireEvent.focus(trigger);
  await settle(0);
  expect(screen.getByText("Question 1 ?")).toBeTruthy();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  await settle(0);
  expect(screen.queryByText("Question 1 ?")).toBeNull();
});

test("the ticket mode lists five questions, counts the rest, and a row opens its question only", async () => {
  const questions = [7, 6, 5, 4, 3, 2, 1].map((n) => question(n, { blocking: n === 1 }));
  const { trigger, onOpen, parent } = mount({ questions });
  fireEvent.focus(trigger);
  await settle(0);
  const rows = screen.getAllByRole("listitem");
  expect(rows.map((r) => r.querySelector("span span:last-child")?.textContent)).toEqual([
    "Question 1 ?",
    "Question 2 ?",
    "Question 3 ?",
    "Question 4 ?",
    "Question 5 ?",
  ]);
  expect(screen.getByText("2 autres…")).toBeTruthy();
  expect(screen.getByRole("img", { name: "bloquante" })).toBeTruthy();
  expect(screen.getAllByText(/^Pour : Client · ouverte · /)).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: /Question 3/ }));
  expect(onOpen).toHaveBeenCalledWith("q3");
  expect(parent).not.toHaveBeenCalled();
});

test("the question mode shows the title, a plain excerpt, the recipient, the state and the ticket", async () => {
  const one = question(1, {
    context: `**Deux** déplacements \`concurrents\` ${"long ".repeat(60)}`,
    options: ["Oui", "Non"],
    provisional: "Oui",
  });
  const { trigger } = mount({ mode: "question", questions: [one] });
  fireEvent.focus(trigger);
  await settle(0);
  expect(screen.getByText("Question 1 ?")).toBeTruthy();
  const excerpt = screen.getByText(/^Deux déplacements concurrents/);
  expect(excerpt.textContent?.endsWith("…")).toBe(true);
  expect((excerpt.textContent ?? "").length).toBeLessThanOrEqual(200);
  expect(screen.getByText("Options : Oui · Non")).toBeTruthy();
  expect(screen.getByText("Pour : Client · ouverte")).toBeTruthy();
  expect(screen.getByText(/· Corriger le formulaire$/)).toBeTruthy();
  expect(screen.getByText(/^posée par opus-dev-1 · /)).toBeTruthy();
});

test("without hover, the trigger stays a plain button and hovering opens nothing", async () => {
  window.matchMedia = ((query: string) => ({
    matches: query === "(hover: none)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  const { trigger } = mount();
  fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
  await settle(400);
  expect(screen.queryByText("Question 1 ?")).toBeNull();
  expect(trigger.getAttribute("data-state")).toBeNull();
});
