import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const c4 = run({ method: "createTicket", title: "Parcours de livraison" }) as Ticket;
  run({ method: "createTicket", title: "Bouton Livrer", parentId: c4.id, statusId: "in_progress" });
  run({ method: "createTicket", title: "Un seul worktree", parentId: c4.id });
};

test("a group has no card; the cards of its sub-tickets carry its chip, which opens it", async () => {
  const m = createMockSdk(manifest, { seed, config: { filter: "all" } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const card = (await screen.findByText("Bouton Livrer")).closest("article");
  expect(screen.getByText("Un seul worktree")).toBeTruthy();
  expect(screen.queryByText("Parcours de livraison")).toBeNull();
  expect(document.querySelectorAll("article")).toHaveLength(2);
  const chip = within(card instanceof HTMLElement ? card : document.body).getByRole("button", {
    name: "Ouvrir l'ensemble KIB-1 · Parcours de livraison",
  });
  expect(chip.textContent).toBe("KIB-1");
  fireEvent.click(chip);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-1")?.id ?? ""]);
});
