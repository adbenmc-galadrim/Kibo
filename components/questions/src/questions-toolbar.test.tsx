import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { Q14, Q16, seedSilo } from "./question-fixtures.test-helper";

afterEach(cleanup);

const mount = () =>
  render(
    <SdkProvider sdk={createMockSdk(manifest, { seed: seedSilo, surface: "view" }).sdk}>
      <Component />
    </SdkProvider>,
  );

test("one row: scope tabs, Pour menu, Ticket menu, right-hand summary 1 bloquante en tête · 3 ouvertes", async () => {
  mount();
  await screen.findByRole("article", { name: Q14 });
  const toolbar = screen.getByRole("toolbar");
  const open = screen.getByRole("radio", { name: "Ouvertes" });
  expect(open.textContent).toBe("Ouvertes3");
  const pour = screen.getByRole("button", { name: "Pour : tous" });
  const ticket = screen.getByRole("button", { name: "Ticket : tous" });
  expect(toolbar.contains(pour) && toolbar.contains(ticket)).toBe(true);
  expect(toolbar.textContent).toContain("1 bloquante en tête · 3 ouvertes");
});

test("the Pour menu filters on a recipient and shows it", async () => {
  mount();
  const user = userEvent.setup();
  await screen.findByRole("article", { name: Q14 });
  await user.click(screen.getByRole("button", { name: "Pour : tous" }));
  await user.click(screen.getByRole("menuitemradio", { name: "Produit (1)" }));
  expect(await screen.findByRole("button", { name: "Pour : Produit" })).toBeTruthy();
  expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([Q16]);
});
