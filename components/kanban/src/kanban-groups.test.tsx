import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const c4 = run({ method: "createTicket", title: "Parcours de livraison" }) as Ticket;
  run({ method: "createTicket", title: "Bouton Livrer", parentId: c4.id, statusId: "in_progress" });
  const nested = run({ method: "createTicket", title: "Un seul worktree", parentId: c4.id }) as Ticket;
  run({ method: "createTicket", title: "Nettoyage", parentId: nested.id });
};

const cardOf = async (title: string) => {
  const card = (await screen.findByText(title)).closest("article");
  return within(card instanceof HTMLElement ? card : document.body);
};

test("a group has no card; the cards of its sub-tickets carry its chip, which opens it", async () => {
  const m = createMockSdk(manifest, { seed, config: { filter: "all" } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const card = await cardOf("Bouton Livrer");
  expect(screen.getByText("Nettoyage")).toBeTruthy();
  expect(screen.queryByText("Parcours de livraison")).toBeNull();
  expect(screen.queryByText("Un seul worktree")).toBeNull();
  expect(document.querySelectorAll("article")).toHaveLength(2);
  const chip = card.getByRole("button", { name: "Ouvrir l'ensemble F1 · Parcours de livraison" });
  expect(chip.textContent).toBe("F1");
  fireEvent.click(chip);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-1")?.id ?? ""]);
});

test("the chip of a nested group, which has no short key, shows the group's key", async () => {
  const m = createMockSdk(manifest, { seed, config: { filter: "all" } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const card = await cardOf("Nettoyage");
  expect(card.getByRole("button", { name: "Ouvrir l'ensemble KIB-3 · Un seul worktree" }).textContent).toBe(
    "KIB-3",
  );
});
