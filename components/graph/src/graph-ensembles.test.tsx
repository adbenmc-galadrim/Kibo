import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const c4 = run({ method: "createTicket", title: "Parcours de livraison" }) as Ticket;
  run({ method: "createTicket", title: "Bouton Livrer", parentId: c4.id, statusId: "done" });
  const nested = run({ method: "createTicket", title: "Étapes visibles", parentId: c4.id }) as Ticket;
  run({ method: "createTicket", title: "Puce d'étape", parentId: nested.id });
  run({ method: "createTicket", title: "Ligne de la fiche", parentId: nested.id });
  run({ method: "createTicket", title: "Un seul worktree", parentId: c4.id });
  const after = run({ method: "createTicket", title: "Après le parcours" }) as Ticket;
  run({ method: "addLink", from: c4.id, to: after.id, type: "blocks" });
};

const setup = () => {
  const m = createMockSdk(manifest, { seed, surface: "view", viewer: "adam", config: { filter: "all" } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const canvas = () => screen.getByRole("region", { name: "Graphe des dépendances" });

test("by default a group is a dashed frame around its sub-tickets, never a node", async () => {
  const m = setup();
  await screen.findByRole("button", { name: /Un seul worktree$/ });
  const frames = Array.from(canvas().querySelectorAll("[data-frame]")).map((f) =>
    f.getAttribute("data-frame"),
  );
  expect(frames.sort()).toEqual(["KIB-1", "KIB-3"]);
  const c4 = canvas().querySelector("[data-frame='KIB-1']");
  expect(c4?.className).toContain("border-dashed");
  expect(c4?.className).toContain("zinc");
  expect(
    within(c4 instanceof HTMLElement ? c4 : document.body).getByText("KIB-1 · Parcours de livraison · 1/3"),
  ).toBeTruthy();
  expect(within(canvas()).queryByRole("button", { name: /Parcours de livraison$/ })).toBeNull();
  expect(within(canvas()).queryByRole("button", { name: /Étapes visibles$/ })).toBeNull();
  expect(screen.getByText("5 tickets · 4 ouverts · 2 démarrables")).toBeTruthy();
  fireEvent.click(within(canvas()).getByRole("button", { name: "Ouvrir l'ensemble KIB-1" }));
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.key === "KIB-1")?.id ?? ""]);
  expect(canvas().querySelectorAll("path[marker-end]").length).toBeGreaterThan(0);
});

test("a folded group is a compact block « C4 · n/m », without agent chips", async () => {
  setup();
  await screen.findByRole("button", { name: /Un seul worktree$/ });
  await userEvent.setup().click(within(canvas()).getByRole("button", { name: "Replier KIB-1" }));
  const block = within(canvas()).getByRole("button", { name: "Déplier KIB-1" });
  expect(block.textContent).toBe("KIB-1 · 1/3");
  expect(block.querySelector("[data-state]")).toBeNull();
  expect(within(canvas()).queryByRole("button", { name: /Un seul worktree$/ })).toBeNull();
});
