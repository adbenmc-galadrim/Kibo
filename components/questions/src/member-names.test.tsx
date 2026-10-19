import { afterEach, expect, test } from "bun:test";
import { type MemberInfo, type ProjectCommand, Question, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { Q16 } from "./question-fixtures.test-helper";

afterEach(cleanup);

const ADAM_ID = "1789b628-9778-4031-95aa-0dbd53d0ebf5";
const GONE_ID = "2a4e8c1d-0b3f-4e5a-9c7d-6f8e9a0b1c2d";
const MEMBERS: MemberInfo[] = [{ userId: ADAM_ID, name: "Adam", role: "owner" }];

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const ticket = Ticket.parse(run({ method: "createTicket", title: "Tests E2E de l'envoi" }));
  const q = Question.parse(
    run({
      method: "createQuestion",
      ticketId: ticket.id,
      title: Q16,
      options: ["2 Go", "5 Go"],
      recipient: "product",
      createdBy: { kind: "human", ref: GONE_ID },
    }),
  );
  run({
    method: "updateQuestion",
    questionId: q.id,
    context: "Quota mesuré par client.",
    by: { kind: "human", ref: GONE_ID },
  });
  run({
    method: "answerQuestion",
    questionId: q.id,
    answer: { kind: "option", option: "2 Go" },
    by: { kind: "human", ref: GONE_ID },
  });
  run({
    method: "updateAnswer",
    questionId: q.id,
    answer: { kind: "option", option: "5 Go" },
    by: { kind: "human", ref: ADAM_ID },
  });
};

const mount = (surface: "view" | "widget") => {
  const m = createMockSdk(manifest, { seed, surface, shared: true, members: MEMBERS, viewer: ADAM_ID });
  const { container } = render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return container;
};

test("an answer is signed with the member's name, an unknown account with a readable label", async () => {
  const container = mount("view");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Toutes" }));
  const card = await screen.findByRole("article", { name: Q16 });
  expect(await within(card).findByText(/^Répondu par Adam · /)).toBeTruthy();
  expect(within(card).getByText("un membre")).toBeTruthy();
  await user.click(within(card).getByRole("button", { name: /^Historique/ }));
  expect(within(card).getByText(/· Adam · Réponse modifiée/)).toBeTruthy();
  expect(within(card).getByText(/· un membre · /)).toBeTruthy();
  expect(container.textContent).not.toContain(ADAM_ID);
  expect(container.textContent).not.toContain(GONE_ID);
});
