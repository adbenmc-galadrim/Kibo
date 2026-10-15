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

test("groups have no row: only launchable tickets are listed, each with the chip of its group", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("Bouton Livrer");
  const titles = Array.from(document.querySelectorAll("li [data-selected]")).map(
    (row) => row.querySelector("button:not([data-group-chip]):not([aria-label])")?.textContent,
  );
  expect(titles).toEqual(["Bouton Livrer", "Puce d'étape", "Ligne de la fiche", "Un seul worktree"]);
  expect(screen.queryByRole("button", { name: "Parcours de livraison" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Étapes visibles" })).toBeNull();
  const chips = Array.from(document.querySelectorAll("[data-group-chip]")).map((c) => c.textContent);
  expect(chips).toEqual(["KIB-1", "KIB-3", "KIB-3", "KIB-1"]);
  expect(screen.queryByRole("button", { name: /^Déplier|^Replier/ })).toBeNull();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Ouvrir l'ensemble KIB-1 · Parcours de livraison" })[0] ??
      document.body,
  );
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-1")?.id ?? ""]);
});
