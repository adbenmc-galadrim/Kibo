import { afterEach, expect, test } from "bun:test";
import { type ProjectCommand, type StatusId, Ticket } from "@kibo/schema";
import { SdkProvider, statusCardClass } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

afterEach(cleanup);

type Row = [string, StatusId, string[]];

const ROWS: Row[] = [
  ["Amont", "todo", ["chapitre:c1"]],
  ["Milieu", "todo", ["chapitre:c1"]],
  ["Aval", "todo", ["chapitre:c2"]],
  ["Socle", "done", ["chapitre:c1"]],
  ["Chantier", "in_progress", ["chapitre:c2"]],
  ["Fin", "todo", []],
  ["Seul", "todo", []],
];

const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [0, 2],
  [3, 0],
  [4, 2],
  [2, 5],
];

const seedWaves = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = ROWS.map(
    ([title, statusId, labels]) =>
      Ticket.parse(
        run({ method: "createTicket", title, statusId, labels, assignee: { kind: "human", ref: "adam" } }),
      ).id,
  );
  for (const [from, to] of LINKS)
    run({ method: "addLink", from: ids[from] ?? "", to: ids[to] ?? "", type: "blocks" });
};

const setup = () => {
  const m = createMockSdk(manifest, {
    seed: seedWaves,
    surface: "view",
    viewer: "adam",
    agentExecution: "shown",
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const canvas = () => screen.getByRole("region", { name: "Graphe des dépendances" });
const node = (title: string) => within(canvas()).getByRole("button", { name: new RegExp(` ${title}$`) });
const ready = () => screen.findByRole("button", { name: / Amont$/ });

test("waves by default; « Hiérarchique » switches to the former layout", async () => {
  setup();
  await ready();
  expect(screen.getByRole("radio", { name: "Vagues" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Vague 1 · démarrables et en cours")).toBeTruthy();
  expect(screen.queryByText("Sans dépendance")).toBeNull();
  const hierarchical = screen.getByRole("radio", { name: "Hiérarchique" });
  expect(hierarchical.hasAttribute("disabled")).toBe(false);
  await userEvent.setup().click(hierarchical);
  expect(screen.getByText("Sans dépendance")).toBeTruthy();
  expect(screen.queryByText("Vague 2")).toBeNull();
});

test("done tickets are hidden behind « Afficher les terminés (n) », shown in the done column", async () => {
  setup();
  await ready();
  expect(within(canvas()).queryByRole("button", { name: / Socle$/ })).toBeNull();
  const toggle = screen.getByRole("button", { name: "Afficher les terminés (1)" });
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  await userEvent.setup().click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(node("Socle")).toBeTruthy();
  expect(screen.getByText("Terminés")).toBeTruthy();
});

test("implied links are drawn only while one of their ends is hovered", async () => {
  setup();
  await ready();
  expect(canvas().querySelectorAll("[data-implied]")).toHaveLength(0);
  expect(screen.getByText("1 lien implicite masqué (survol pour les voir)").closest("section")).toBeNull();
  const user = userEvent.setup();
  await user.hover(node("Amont"));
  expect(canvas().querySelectorAll("[data-implied]")).toHaveLength(1);
  await user.unhover(node("Amont"));
  expect(canvas().querySelectorAll("[data-implied]")).toHaveLength(0);
});

test("a click focuses two levels of blockers and unblocked tickets, Escape leaves", async () => {
  setup();
  await ready();
  const user = userEvent.setup();
  await user.click(node("Milieu"));
  const focus = (title: string) => node(title).getAttribute("data-focus");
  expect(["Milieu", "Amont", "Aval", "Fin"].map(focus)).toEqual(["in", "in", "in", "in"]);
  expect(["Chantier", "Seul"].map(focus)).toEqual(["out", "out"]);
  expect(screen.getByText("1 bloqueur · débloque 2 tickets, sur deux niveaux")).toBeTruthy();
  canvas().focus();
  await user.keyboard("{Escape}");
  expect(canvas().querySelectorAll("[data-focus]")).toHaveLength(0);
});

test("semantic zoom: a pill below 0.6, the full card from 0.6; the status colors the whole card", async () => {
  setup();
  await ready();
  const user = userEvent.setup();
  const card = node("Amont");
  expect(card.getAttribute("data-variant")).toBe("card");
  expect(card.className).toContain(statusCardClass("todo"));
  expect(card.querySelector(".rounded-full.size-2")).toBeNull();
  expect(within(card).getByText("chapitre:c1")).toBeTruthy();
  expect(within(card).getByText("Démarrable").className).toContain("text-[11px]");
  for (let i = 0; i < 5; i += 1) await user.click(screen.getByRole("button", { name: "Zoom arrière" }));
  expect(canvas().getAttribute("data-zoom")).toBe("0.5");
  const header = within(canvas()).getByText("Vague 1 · démarrables et en cours");
  expect(header.style.fontSize).toBe("24px");
  expect(header.getAttribute("title")).toBe("Vague 1 · démarrables et en cours");
  expect(within(canvas()).getByText("De loin : clé et statut · de près : titre et étiquettes")).toBeTruthy();
  const pill = node("Amont");
  expect(pill.getAttribute("data-variant")).toBe("pill");
  expect(pill.className).toContain(statusCardClass("todo"));
  expect(within(pill).queryByText("Amont")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Zoom avant" }));
  expect(canvas().getAttribute("data-zoom")).toBe("0.6");
  expect(node("Amont").getAttribute("data-variant")).toBe("card");
  expect(within(node("Amont")).getByText("Amont")).toBeTruthy();
});

test("« Affichage »: grouping by label prefix frames the tickets, frames fold and unfold", async () => {
  setup();
  await ready();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Affichage" }));
  expect(screen.getByRole("menuitem", { name: "Déplier tous les cadres" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Replier tous les cadres" })).toBeTruthy();
  await user.click(screen.getByRole("menuitem", { name: "Regrouper par étiquette" }));
  fireEvent.click(await screen.findByRole("menuitemradio", { name: "chapitre:" }));
  expect(await screen.findByRole("button", { name: "Affichage · chapitre:" })).toBeTruthy();
  expect(within(canvas()).getByText("c1 · 2 tickets")).toBeTruthy();
  expect(within(canvas()).getByText("c2 · 2 tickets")).toBeTruthy();
  await user.click(within(canvas()).getByRole("button", { name: "Replier c1" }));
  expect(within(canvas()).queryByRole("button", { name: / Amont$/ })).toBeNull();
  expect(within(canvas()).getByRole("button", { name: "Déplier c1" }).textContent).toContain(
    "c1 · 2 tickets",
  );
  await user.click(screen.getByRole("button", { name: "Affichage · chapitre:" }));
  await user.click(screen.getByRole("menuitem", { name: "Replier tous les cadres" }));
  expect(within(canvas()).getByRole("button", { name: "Déplier c2" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Affichage · chapitre:" }));
  await user.click(screen.getByRole("menuitem", { name: "Déplier tous les cadres" }));
  expect(node("Amont")).toBeTruthy();
  expect(node("Chantier")).toBeTruthy();
});

test("« Démarrables » narrows the graph to startable tickets", async () => {
  setup();
  await ready();
  expect(screen.getByText("7 tickets · 6 ouverts · 2 démarrables")).toBeTruthy();
  const toggle = screen.getByRole("button", { name: "Démarrables" });
  await userEvent.setup().click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(within(canvas()).queryByRole("button", { name: / Milieu$/ })).toBeNull();
  expect(node("Amont")).toBeTruthy();
});

test("a node with a live run carries the agent mention", async () => {
  const m = setup();
  await ready();
  const id = m.snapshot().tickets.find((t) => t.title === "Chantier")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-1", state: "running", position: null }]),
  );
  expect(await within(canvas()).findByRole("button", { name: "opus-dev-1" })).toBeTruthy();
});
