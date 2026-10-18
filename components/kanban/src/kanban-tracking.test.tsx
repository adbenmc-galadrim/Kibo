import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { trackingSeed } from "./test-seed";

beforeEach(() => setSystemTime(new Date(2026, 9, 17, 10, 0)));
afterEach(() => {
  cleanup();
  setSystemTime();
});

const setup = () => {
  const m = createMockSdk(manifest, { seed: trackingSeed, viewer: "adam" });
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

test("a step with an open blocking question says « bloqué · Q14 », and no longer once answered", async () => {
  const m = setup();
  const excel = await card("Lecture du fichier Excel");
  expect(within(excel).getByText("bloqué · Q14")).toBeTruthy();
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
  expect(screen.getByText("Lecture du fichier Excel")).toBeTruthy();
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
