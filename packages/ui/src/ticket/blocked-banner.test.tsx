import { afterEach, expect, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type Question, type TicketView } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siloFeatureProject } from "../shell/feature/fixture";
import { BlockedBanner } from "./BlockedBanner";

afterEach(cleanup);

const project = siloFeatureProject();
const ticket = project.tickets.find((t) => t.id === "e33") as TicketView;
const question = (patch: Partial<Question> = {}): Question => ({
  kind: "question",
  images: [],
  id: "q14",
  ticketId: "e33",
  runId: null,
  title: "Un box réaffecté garde-t-il ses photos ?",
  context: "",
  options: [],
  provisional: null,
  blocking: true,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: new Date(2026, 9, 12, 9, 0).getTime(),
  number: 14,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...patch,
});
const draw = (
  questions: Question[],
  onOpen: (id: string) => void = () => undefined,
  held: TicketView = ticket,
) =>
  render(
    <BlockedBanner ticket={held} questions={questions} recipients={DEFAULT_RECIPIENTS} onOpen={onOpen} />,
  );

test("a blocking question puts a red banner naming it, its recipient and when it was sent", async () => {
  const opened: string[] = [];
  draw([question({ sentAt: new Date(2026, 9, 14, 10, 5).getTime() })], (id) => opened.push(id));
  const banner = screen.getByRole("alert", { name: "Ticket bloqué" });
  expect(banner.textContent).toContain("Bloqué par Q14 (Client, envoyée le 14 oct.)");
  expect(banner.className).toContain("red");
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir" }));
  expect(opened).toEqual(["q14"]);
});

test("a question not sent yet says when it was asked", () => {
  draw([question()]);
  expect(screen.getByRole("alert").textContent).toContain("Bloqué par Q14 (Client, posée le 12 oct.)");
});

test("no banner without an open blocking question", () => {
  const { container } = draw([
    question({ blocking: false }),
    question({ id: "q2", archivedAt: 5, archivedBy: { kind: "human", ref: "adam" } }),
  ]);
  expect(container.textContent).toBe("");
});

test("a step not started yet is blocked by the question of its feature", () => {
  draw([question({ ticketId: "f5" })], undefined, { ...ticket, statusId: "todo" });
  const banner = screen.getByRole("alert", { name: "Ticket bloqué" });
  expect(banner.textContent).toContain("Bloqué par Q14 (Client, posée le 12 oct.)");
});

test("a step in progress only mentions the question of its feature, without blocking", async () => {
  const opened: string[] = [];
  draw([question({ ticketId: "f5" })], (id) => opened.push(id));
  expect(screen.queryByRole("alert")).toBeNull();
  const note = screen.getByRole("status", { name: "Question sur la fonctionnalité" });
  expect(note.textContent).toContain("Q14 ouverte sur la fonctionnalité (Client, posée le 12 oct.)");
  expect(note.className).not.toContain("red");
  await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir" }));
  expect(opened).toEqual(["q14"]);
});
