import { expect, test } from "bun:test";
import type { ProjectCommand, Question } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const TITLE = "Valider l'écran 1.2 ?";
const IMAGES = [
  { id: "i1", name: "1-no-access.png", bytes: 1200, width: 1440, height: 900 },
  { id: "i2", name: "2-sign-in.png", bytes: 900, width: 1440, height: 900 },
];

const seedValidation =
  (images: typeof IMAGES, answered = false) =>
  (run: (cmd: ProjectCommand) => unknown) => {
    const ids = seedDemo(run);
    const q = run({
      method: "createQuestion",
      ticketId: ids["KIB-12"] ?? "",
      title: TITLE,
      options: ["Valider", "Demander une correction"],
      blocking: true,
      runId: "r1",
      createdBy: { kind: "agent", ref: "full-delivery" },
      kind: "validation",
      images,
    }) as Question;
    if (answered) {
      run({
        method: "answerQuestion",
        questionId: q.id,
        answer: { kind: "option", option: "Valider" },
        by: { kind: "human", ref: "adam" },
      });
    }
  };

const mount = (images = IMAGES, answered = false) => {
  const m = createMockSdk(manifest, {
    seed: seedValidation(images, answered),
    surface: "view",
    config: { scope: "all" },
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const answerOf = (m: ReturnType<typeof mount>) =>
  m.snapshot().questions.find((q) => q.title === TITLE)?.answer;

test("an open screen validation offers two primary buttons instead of the free form", async () => {
  mount();
  const card = await screen.findByRole("article", { name: TITLE });
  const actions = within(card).getByRole("group", { name: "Validation de l'écran" });
  expect(
    within(actions)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Valider", "Demander une correction"]);
  expect(within(card).queryByRole("textbox", { name: "Autre réponse…" })).toBeNull();
  expect(within(card).queryByText(/^Options :/)).toBeNull();
});

test("« Valider » answers with the Valider option", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: TITLE });
  await user.click(within(card).getByRole("button", { name: "Valider" }));
  await waitFor(() =>
    expect(answerOf(m)).toMatchObject({
      kind: "option",
      option: "Valider",
      by: { kind: "human", ref: "adam" },
    }),
  );
});

test("« Demander une correction » needs a text and sends it prefixed", async () => {
  const m = mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: TITLE });
  await user.click(within(card).getByRole("button", { name: "Demander une correction" }));
  const field = within(card).getByRole("textbox", { name: "Ta correction" });
  const send = within(card).getByRole("button", { name: "Envoyer la correction" });
  expect(send.hasAttribute("disabled")).toBe(true);
  await user.type(field, "  Le bouton doit rester visible sur mobile. ");
  expect(send.hasAttribute("disabled")).toBe(false);
  await user.click(send);
  await waitFor(() =>
    expect(answerOf(m)).toMatchObject({
      kind: "text",
      text: "Demander une correction : Le bouton doit rester visible sur mobile.",
    }),
  );
});

test("cancelling the correction folds the field back", async () => {
  mount();
  const user = userEvent.setup();
  const card = await screen.findByRole("article", { name: TITLE });
  await user.click(within(card).getByRole("button", { name: "Demander une correction" }));
  await user.click(within(card).getByRole("button", { name: "Annuler" }));
  expect(within(card).queryByRole("textbox", { name: "Ta correction" })).toBeNull();
  expect(within(card).getByRole("button", { name: "Valider" })).toBeTruthy();
});

test("an answered validation shows its answer without the buttons", async () => {
  mount(IMAGES, true);
  const card = await screen.findByRole("article", { name: TITLE });
  expect(within(card).getByText("Réponse : Valider")).toBeTruthy();
  expect(within(card).queryByRole("group", { name: "Validation de l'écran" })).toBeNull();
});

test("a validation without a valid image is an ordinary question with its two options", async () => {
  mount([]);
  const card = await screen.findByRole("article", { name: TITLE });
  expect(within(card).queryByRole("group", { name: "Validation de l'écran" })).toBeNull();
  expect(within(card).getByRole("textbox", { name: "Autre réponse…" })).toBeTruthy();
  expect(within(card).getByRole("button", { name: "Demander une correction" })).toBeTruthy();
});
