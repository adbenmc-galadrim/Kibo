import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardSheet } from "./CardSheet";
import { Component, manifest } from "./index";
import { seed } from "./test-seed";

afterEach(cleanup);

const MAC_OFF = "Mac éteint";

const readOnlyBoard = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", writeBlock: MAC_OFF });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const disabled = (el: HTMLElement) =>
  el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";

const inDisabled = (el: HTMLElement) => el.closest('[aria-disabled="true"], [disabled]') !== null;

test("read-only, the cards cannot be dragged and the add buttons are greyed with the reason", async () => {
  readOnlyBoard();
  const todo = await screen.findByRole("region", { name: "À faire" });
  const card = within(todo).getAllByRole("article")[0];
  if (!card) throw new Error("no card");
  card.focus();
  await userEvent.setup().keyboard("[Space]");
  expect(document.querySelector('[data-slot="kanban-drag-preview"]')).toBeNull();
  const add = within(todo).getByRole("button", { name: "Nouveau ticket dans À faire" });
  expect(disabled(add)).toBe(true);
  expect(add.title).toBe(MAC_OFF);
});

test("read-only, the card menu greys moves and removal but still opens the ticket", async () => {
  const m = readOnlyBoard();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-1" }));
  const remove = await screen.findByRole("menuitem", { name: new RegExp(`Supprimer….*${MAC_OFF}`) });
  expect(remove.getAttribute("aria-disabled")).toBe("true");
  await user.click(screen.getByRole("menuitem", { name: "Déplacer vers" }));
  const target = await screen.findByRole("menuitem", { name: new RegExp(`En cours.*${MAC_OFF}`) });
  expect(target.getAttribute("aria-disabled")).toBe("true");
  await user.click(screen.getByRole("menuitem", { name: "Ouvrir" }));
  expect(m.opened.length).toBe(1);
});

test("read-only, a card stays readable: neither it nor its title is disabled and the title opens the ticket", async () => {
  const m = readOnlyBoard();
  const todo = await screen.findByRole("region", { name: "À faire" });
  for (const card of within(todo).getAllByRole("article")) expect(inDisabled(card)).toBe(false);
  const card = within(todo).getByRole("article", { name: /Arbre des pages/ });
  const title = within(card).getByRole("button", { name: "Arbre des pages" });
  expect(inDisabled(title)).toBe(false);
  await userEvent.setup().click(title);
  expect(m.opened.length).toBe(1);
});

test("read-only, the filters stay usable", async () => {
  readOnlyBoard();
  await screen.findByRole("region", { name: "À faire" });
  const startable = screen.getByRole("button", { name: "Démarrable" });
  expect(disabled(startable)).toBe(false);
  await userEvent.setup().click(startable);
  expect(startable.getAttribute("aria-pressed")).toBe("true");
});

test("read-only, the sheet greys every write with the reason and keeps Ouvrir la fiche", () => {
  const m = createMockSdk(manifest, { seed, writeBlock: MAC_OFF });
  const ticket = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-1");
  if (!ticket) throw new Error("no seeded ticket");
  render(
    <SdkProvider sdk={m.sdk}>
      <CardSheet
        ticket={ticket}
        statuses={m.snapshot().workflow}
        launch={{ blocked: MAC_OFF }}
        onClose={() => undefined}
        onOpen={() => undefined}
        onMove={() => undefined}
        onLaunch={() => undefined}
        onRemove={() => undefined}
      />
    </SdkProvider>,
  );
  const sheet = screen.getByRole("dialog");
  for (const name of [/Déplacer vers…/, /Lancer dans T3/, /Bloquer…/, /Retirer/]) {
    const row = within(sheet).getByRole("button", { name });
    expect(disabled(row)).toBe(true);
    expect(row.textContent).toContain(MAC_OFF);
  }
  expect(disabled(within(sheet).getByRole("button", { name: "Ouvrir la fiche" }))).toBe(false);
});
