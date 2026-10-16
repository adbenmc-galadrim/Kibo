import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen } from "@testing-library/react";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const c4 = run({ method: "createTicket", title: "Parcours de livraison" }) as Ticket;
  run({ method: "createTicket", title: "Bouton Livrer", parentId: c4.id });
  const nested = run({ method: "createTicket", title: "Étapes visibles", parentId: c4.id }) as Ticket;
  run({ method: "createTicket", title: "Puce d'étape", parentId: nested.id });
  run({ method: "createTicket", title: "Ligne de la fiche", parentId: nested.id });
  run({ method: "createTicket", title: "Un seul worktree", parentId: c4.id });
};

test("groups have no row: the launchable tickets are listed, each with the chip of its feature", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("Bouton Livrer");
  const titles = Array.from(document.querySelectorAll("li [data-selected] [data-row-title]")).map(
    (b) => b.textContent,
  );
  expect(titles).toEqual(["Bouton Livrer", "Puce d'étape", "Ligne de la fiche", "Un seul worktree"]);
  expect(screen.queryByRole("button", { name: "Parcours de livraison" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Étapes visibles" })).toBeNull();
  const chips = screen.getAllByRole("button", {
    name: "Ouvrir la fonctionnalité F1 · Parcours de livraison",
  });
  expect(chips).toHaveLength(4);
  fireEvent.click(chips[0] ?? document.body);
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-1")?.id ?? ""]);
});
