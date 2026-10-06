import { expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

const PREVIEW = '[data-slot="kanban-drag-preview"]';

const setup = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const previewOf = (): HTMLElement => {
  const preview = document.querySelector(PREVIEW);
  if (!(preview instanceof HTMLElement)) throw new Error("drag preview missing");
  return preview;
};

test("a dragged card is shown in a preview outside the board, the card stays as a faded slot", async () => {
  setup();
  const todo = await screen.findByRole("region", { name: "À faire" });
  const board = todo.parentElement;
  if (!board) throw new Error("board missing");
  const card = within(todo).getByRole("article", { name: /Arbre des pages/ });
  expect(document.querySelector(PREVIEW)).toBeNull();
  card.focus();
  const user = userEvent.setup();
  await user.keyboard("[Space]");
  const preview = await waitFor(previewOf);
  expect(board.contains(preview)).toBe(false);
  expect(preview.closest('[data-slot="kanban-cards"]')).toBeNull();
  expect(preview.getAttribute("aria-hidden")).toBe("true");
  expect(preview.textContent).toContain("Arbre des pages");
  expect(within(preview).queryByRole("button")).toBeNull();
  expect(card.className).toContain("opacity-40");
  expect(card.style.transform).toBe("");
  await user.keyboard("[Escape]");
  await waitFor(() => expect(document.querySelector(PREVIEW)).toBeNull());
  expect(card.className).not.toContain("opacity-40");
});
