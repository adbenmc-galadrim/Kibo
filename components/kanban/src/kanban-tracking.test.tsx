import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { trackingSeed } from "./test-seed";

afterEach(cleanup);

const setup = () => {
  const m = createMockSdk(manifest, { seed: trackingSeed, viewer: "adam", today: "2026-10-17" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const card = async (title: string) => {
  const found = (await screen.findByText(title)).closest("article");
  if (!(found instanceof HTMLElement)) throw new Error(`no card ${title}`);
  return found;
};

const column = (name: string) => screen.getByRole("region", { name });

test("a step with an open blocking question says « bloqué · Q14 » in Bloqué, and goes back once answered", async () => {
  const m = setup();
  const excel = await card("Lecture du fichier Excel");
  expect(within(excel).getByText("bloqué · Q14")).toBeTruthy();
  expect(within(column("Bloqué")).getByText("Lecture du fichier Excel")).toBeTruthy();
  expect(within(column("À faire")).queryByText("Lecture du fichier Excel")).toBeNull();
  expect(within(excel).queryByText("1 question")).toBeNull();
  const question = m.snapshot().questions[0];
  if (!question) throw new Error("no question");
  act(() => {
    m.run({
      method: "answerQuestion",
      questionId: question.id,
      answer: { kind: "text", text: "CSV" },
      by: { kind: "human", ref: "adam" },
    });
  });
  await waitFor(() => {
    if (screen.queryByText("bloqué · Q14") !== null) throw new Error("still blocked");
  });
  expect(within(column("À faire")).getByText("Lecture du fichier Excel")).toBeTruthy();
});

test("a « Démo client » step is titled after its feature, an optional one says so", async () => {
  setup();
  const optional = await card("Démo · F1");
  expect(within(optional).getByText("facultative")).toBeTruthy();
  const required = await card("Démo · F2");
  expect(within(required).queryByText("facultative")).toBeNull();
  expect(screen.queryByText("Démo client")).toBeNull();
});

test("a card shows its PR, the requested changes and the broken CI", async () => {
  setup();
  const conflicts = await card("Conflits de saisie");
  expect(within(conflicts).getByText("#20")).toBeTruthy();
  expect(within(conflicts).getByLabelText("changements demandés")).toBeTruthy();
  expect(within(conflicts).getByLabelText("CI cassée")).toBeTruthy();
  const expo = await card("Passage à Expo SDK 54");
  expect(within(expo).getByLabelText("CI en cours")).toBeTruthy();
  expect(within(expo).queryByLabelText("changements demandés")).toBeNull();
});

test("« Copier /full-delivery » copies the command and confirms it", async () => {
  const m = setup();
  const user = userEvent.setup();
  const conflicts = await card("Conflits de saisie");
  const key = conflicts.getAttribute("data-key") ?? "";
  await user.click(within(conflicts).getByRole("button", { name: `Actions ${key}` }));
  await user.pointer({
    keys: "[MouseLeft]",
    target: await screen.findByRole("menuitem", { name: `Copier /full-delivery ${key}` }),
  });
  await waitFor(() => expect(m.toasts).toEqual(["Copié"]));
  expect(await navigator.clipboard.readText()).toBe(`/full-delivery ${key}`);
});

test("a ticket with the Bloqué status and its reason sits in Bloqué the same way", async () => {
  const m = setup();
  const excel = m.snapshot().tickets.find((t) => t.title === "Écran d'import");
  if (!excel) throw new Error("no ticket");
  act(() => {
    m.run({ method: "setStatus", ticketId: excel.id, statusId: "blocked", reason: "Fichier client" });
  });
  const blocked = await card("Écran d'import");
  expect(within(column("Bloqué")).getByText("Écran d'import")).toBeTruthy();
  expect(within(blocked).getByText("bloqué")).toBeTruthy();
  expect(within(blocked).getByText("Motif : Fichier client")).toBeTruthy();
});

test("no card says « Démarrable »; a step waiting for its sprint says which one", async () => {
  setup();
  const later = await card("Écran d'import");
  expect(within(later).getByText("sprint S43")).toBeTruthy();
  for (const article of screen.getAllByRole("article"))
    expect(within(article).queryByText("Démarrable")).toBeNull();
  expect(within(await card("Démo · F1")).queryByText(/^sprint/)).toBeNull();
});

test("a step with a branch and no PR shows its branch, a step with a PR does not", async () => {
  setup();
  const later = await card("Écran d'import");
  expect(within(later).getByLabelText("Branche feat/emis-import")).toBeTruthy();
  expect(within(await card("Conflits de saisie")).queryByLabelText(/^Branche/)).toBeNull();
});
