import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "./fr";
import { Component, manifest } from "./index";
import { ADAM, Q14, Q16, Q17, seedSilo } from "./question-fixtures.test-helper";

const realMatchMedia = window.matchMedia;
const realAnimate = Element.prototype.animate;

afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  Element.prototype.animate = realAnimate;
});

const countAnimations = () => {
  const calls = { count: 0 };
  Element.prototype.animate = function animate() {
    calls.count += 1;
    return { addEventListener: () => {}, cancel: () => {}, finished: Promise.resolve() };
  } as unknown as typeof Element.prototype.animate;
  return calls;
};

const switchScope = async () => {
  const user = userEvent.setup();
  const row = await rowOf(Q14);
  await user.click(titleButton(row, Q14));
  expect(within(row).getByRole("textbox", { name: fr.yourAnswer })).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Archivées" }));
  await waitFor(() => expect(screen.queryByRole("article", { name: Q14 })).toBeNull());
};

const mount = () => {
  const m = createMockSdk(manifest, { seed: seedSilo, surface: "view", client: "Silo SA" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const rowOf = (title: string) => screen.findByRole("article", { name: title });
const titleButton = (row: HTMLElement, title: string) => within(row).getByRole("button", { name: title });

test("one row per question with Qn, truncated title with a tooltip, recipient, the red bloquante pill as the only mark, ticket key, age, chevron", async () => {
  mount();
  const row = await rowOf(Q14);
  expect(within(row).getByText("Q3").className).toContain("font-mono");
  const title = within(row).getByText(Q14);
  expect(title.className).toContain("truncate");
  expect(within(row).getByText("Silo SA")).toBeTruthy();
  expect(within(row).getByRole("button", { name: /^KIB-|^F\d|^T\d|Lecture/ })).toBeTruthy();
  expect(within(row).getByText("1 min")).toBeTruthy();
  expect(row.querySelector("[data-chevron]")).toBeTruthy();
  const red = Array.from(row.querySelectorAll("*")).filter((el) => el.classList.contains("text-destructive"));
  expect(red.map((el) => el.textContent)).toEqual([fr.blocking]);
  fireEvent.pointerMove(title, { pointerType: "mouse" });
  expect((await screen.findByRole("tooltip")).textContent).toContain(Q14);
});

test("blocking first then Qn ascending, no grouping by ticket", async () => {
  mount();
  await rowOf(Q14);
  expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([Q14, Q17, Q16]);
  expect(screen.queryByRole("region")).toBeNull();
});

test("a click expands one row at a time with the full text, recipient select, posée par · age, Historique, the … menu, the answer field with a neutral Coller la réponse and Répondre", async () => {
  mount();
  const user = userEvent.setup();
  const row = await rowOf(Q14);
  expect(within(row).queryByRole("textbox")).toBeNull();
  await user.click(titleButton(row, Q14));
  expect(within(row).getByRole("button", { name: "Destinataire : Silo SA" })).toBeTruthy();
  expect(within(row).getByText(/posée par/).textContent).toContain("adam · à l'instant");
  expect(within(row).getByText("Historique")).toBeTruthy();
  expect(within(row).getByRole("button", { name: "Actions de Q3" })).toBeTruthy();
  expect(within(row).getByRole("textbox", { name: fr.yourAnswer })).toBeTruthy();
  const paste = within(row).getByRole("button", { name: fr.paste.open });
  expect(paste.dataset.variant).toBe("outline");
  expect(within(row).getByRole("button", { name: fr.reply })).toBeTruthy();
  const other = await rowOf(Q16);
  await user.click(titleButton(other, Q16));
  expect(within(other).getByRole("textbox", { name: fr.yourAnswer })).toBeTruthy();
  expect(within(row).queryByRole("textbox")).toBeNull();
  await user.click(titleButton(other, Q16));
  expect(within(other).queryByRole("textbox")).toBeNull();
});

test("?question=Q14 expands and spotlights the row", async () => {
  const m = mount();
  const row = await rowOf(Q14);
  const id = m.snapshot().questions.find((q) => q.title === Q14)?.id ?? "";
  act(() => m.setSpotlight({ kind: "question", id }));
  await waitFor(() => expect(row.hasAttribute("data-spotlight")).toBe(true));
  expect(within(row).getByRole("textbox", { name: fr.yourAnswer })).toBeTruthy();
});

test("answered and archived questions keep the same row with their state", async () => {
  const m = mount();
  const user = userEvent.setup();
  const idOf = (title: string) => m.snapshot().questions.find((q) => q.title === title)?.id ?? "";
  act(() => {
    m.run({
      method: "answerQuestion",
      questionId: idOf(Q14),
      answer: { kind: "text", text: "Oui" },
      by: ADAM,
    });
    m.run({ method: "archiveQuestion", questionId: idOf(Q17), by: ADAM });
  });
  await user.click(await screen.findByRole("radio", { name: "Répondues" }));
  const answered = await rowOf(Q14);
  expect(within(answered).getByText(fr.state.answered)).toBeTruthy();
  expect(within(answered).queryByText(fr.blocking)).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Archivées" }));
  expect(within(await rowOf(Q17)).getByText(fr.state.archived)).toBeTruthy();
});

test("the menu of an open question edits its text", async () => {
  const m = mount();
  const user = userEvent.setup();
  const row = await rowOf(Q16);
  await user.click(titleButton(row, Q16));
  await user.click(within(row).getByRole("button", { name: "Actions de Q2" }));
  await user.click(screen.getByRole("menuitem", { name: fr.edit.open }));
  const dialog = await screen.findByRole("dialog", { name: fr.edit.title });
  const field = within(dialog).getByRole("textbox", { name: fr.dialog.questionTitle });
  await user.clear(field);
  await user.type(field, "Quota de 5 Go ?");
  await user.click(within(dialog).getByRole("button", { name: fr.save }));
  await waitFor(() => expect(m.snapshot().questions.some((q) => q.title === "Quota de 5 Go ?")).toBe(true));
});

test("reduced motion: the list changes without any animation", async () => {
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  const calls = countAnimations();
  mount();
  await switchScope();
  expect(calls.count).toBe(0);
});

test("without matchMedia the list still renders and expands", async () => {
  Reflect.set(window, "matchMedia", undefined);
  countAnimations();
  mount();
  await switchScope();
});
