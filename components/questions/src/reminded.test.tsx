import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { type ProjectCommand, Question, type Surface } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";
import { lastReminder } from "./questions-logic";

const NOW = new Date("2026-10-16T14:52:00").getTime();
const HOUR = 3_600_000;
const ADAM = { kind: "human" as const, ref: "adam" };
const REMINDED = "Un box réaffecté garde-t-il ses photos ?";
const ANSWERED = "Faut-il garder l'export PDF ?";

beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => setSystemTime());

function seed(run: (cmd: ProjectCommand) => unknown) {
  const ids = seedDemo(run);
  const ticketId = ids["KIB-12"] ?? "";
  const ask = (title: string) =>
    Question.parse(run({ method: "createQuestion", ticketId, title, createdBy: ADAM }));
  const open = ask(REMINDED);
  run({ method: "remindQuestion", questionId: open.id, by: ADAM, at: NOW - 3 * HOUR });
  run({ method: "remindQuestion", questionId: open.id, by: ADAM, at: NOW - 2 * HOUR });
  const answered = ask(ANSWERED);
  run({ method: "remindQuestion", questionId: answered.id, by: ADAM, at: NOW - HOUR });
  run({ method: "answerQuestion", questionId: answered.id, answer: { kind: "text", text: "Oui" }, by: ADAM });
}

function mount(surface: Surface) {
  const m = createMockSdk(manifest, { seed, surface, config: { scope: "all" } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
}

test("lastReminder gives the last reminder of an unanswered question only", () => {
  const m = createMockSdk(manifest, { seed });
  const [open, answered] = m.snapshot().questions;
  if (!open || !answered) throw new Error("questions missing");
  expect(lastReminder(open)).toBe(NOW - 2 * HOUR);
  expect(lastReminder(answered)).toBeNull();
});

test("the question card says when it was last reminded while unanswered", async () => {
  mount("view");
  const card = within(await screen.findByRole("article", { name: REMINDED }));
  expect(card.getByText("relancée · il y a 2 h")).toBeTruthy();
  expect(screen.queryAllByText(/^relancée ·/)).toHaveLength(1);
});

test("the widget row says it too", async () => {
  mount("widget");
  expect(await screen.findByText("relancée · il y a 2 h")).toBeTruthy();
  expect(screen.queryAllByText(/^relancée ·/)).toHaveLength(1);
});
