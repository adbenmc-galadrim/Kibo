import { afterEach, beforeEach, expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PRS_SEED_COUNTER, seedPrGraph, seedPrUrl } from "./graph-prs-seed";
import { Component, manifest } from "./index";

beforeEach(() => localStorage.setItem("kibo.graph.view.mock-instance", "prs"));
afterEach(() => {
  cleanup();
  localStorage.clear();
});

type Seed = (run: (cmd: ProjectCommand) => unknown) => void;

const setup = (seed: Seed = seedPrGraph) => {
  const m = createMockSdk(manifest, { seed, surface: "view", viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const region = () => screen.findByRole("region", { name: "PR ouvertes" });
const card = (n: number): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-pr="${n}"]`);
  if (found === null) throw new Error(`missing PR #${n}`);
  return found;
};
const ticket = (m: ReturnType<typeof setup>, title: string): Ticket => {
  const found = m.snapshot().tickets.find((t) => t.title === title);
  if (found === undefined) throw new Error(`missing ${title}`);
  return found;
};

test("three stacks, five cards from each root up, labels, rail and counter", async () => {
  const m = setup();
  const canvas = await region();
  expect(
    within(canvas)
      .getAllByRole("group")
      .map((g) => g.getAttribute("aria-label")),
  ).toEqual([
    "3 PR empilées · F5 · Envoyer les photos d'un constat · #22 à #25",
    "1 PR · F4 · Saisir un constat hors ligne · #20",
    "1 PR · Hors fonctionnalité · #23",
  ]);
  expect(Array.from(canvas.querySelectorAll("[data-pr]")).map((b) => b.getAttribute("data-pr"))).toEqual([
    "22",
    "24",
    "25",
    "20",
    "23",
  ]);
  const key33 = ticket(m, "Écran d'envoi hors ligne").key ?? "";
  for (const text of [
    key33,
    "F5 · Envoyer les photos d'un constat",
    "Brouillon",
    "CI en cours",
    "feat/envoi-hors-ligne",
  ])
    expect(card(24).textContent).toContain(text);
  expect(card(24).getAttribute("aria-label")).toBe(`PR #24 · Écran d'envoi hors ligne · ${key33}`);
  expect(card(20).textContent).toContain("Changements demandés");
  expect(card(20).textContent).toContain("CI rouge");
  expect(card(20).getAttribute("data-review")).toBe("changes");
  expect(card(22).textContent).toContain("En attente de review");
  expect(card(22).textContent).toContain("CI verte");
  expect(card(22).textContent).not.toContain("session");
  expect(within(canvas).getByText("sur feat/silo-32")).toBeTruthy();
  expect(within(canvas).getByText("sur feat/envoi-hors-ligne")).toBeTruthy();
  expect(within(canvas).getByText("dev")).toBeTruthy();
  expect(within(canvas).getByText("branche de base")).toBeTruthy();
  expect(screen.getByText(PRS_SEED_COUNTER)).toBeTruthy();
});

test("a click on a card opens its ticket", async () => {
  const m = setup();
  await region();
  await userEvent.click(card(25));
  expect(m.opened).toEqual([ticket(m, "Tests E2E de l'envoi").id]);
});

test("the legend lists the ten marks, « Approuvée » included", async () => {
  setup();
  await region();
  await userEvent.click(screen.getByRole("button", { name: "Légende" }));
  const items = within(screen.getByRole("list", { name: "Légende" })).getAllByRole("listitem");
  expect(items.map((i) => i.textContent)).toEqual([
    "Brouillon",
    "En attente de review",
    "Changements demandés",
    "Approuvée",
    "CI verte",
    "CI rouge",
    "CI en cours",
    "Basée sur la PR du dessous",
    "Session active",
    "Clic : fiche du ticket",
  ]);
});

const withoutPr: Seed = (run) => {
  const root = run({ method: "createTicket", title: "Exporter le dossier client" }) as Ticket;
  run({ method: "createTicket", title: "Format du dossier", parentId: root.id });
};

test("without any live PR the canvas says so, with no rail and no legend", async () => {
  setup(withoutPr);
  const canvas = await region();
  expect(within(canvas).getByText("Aucune PR ouverte")).toBeTruthy();
  expect(
    within(canvas).getByText(
      "Les PR ouvertes des étapes apparaissent ici, empilées sur leur branche de base.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("0 PR ouverte · 0 pile")).toBeTruthy();
  expect(screen.queryByText("branche de base")).toBeNull();
  expect(screen.queryByRole("list", { name: "Légende" })).toBeNull();
});

const offRail: Seed = (run) => {
  const add = (title: string, number: number, base: string, review: "none" | "approved") => {
    const t = run({ method: "createTicket", title, statusId: "in_review" }) as Ticket;
    run({
      method: "upsertExternalRef",
      ticketId: t.id,
      ref: {
        kind: "github_pr",
        url: seedPrUrl(number),
        number,
        state: "open",
        base,
        head: `feat/${number}`,
        review,
        checks: null,
      },
    });
  };
  add("Corriger le tri", 30, "dev", "approved");
  add("Corriger le filtre", 31, "dev", "none");
  add("Préparer la version", 32, "release/1.2", "none");
};

test("an approved PR says so, a root off the rail names its base", async () => {
  setup(offRail);
  const canvas = await region();
  expect(card(30).textContent).toContain("Approuvée");
  expect(card(30).getAttribute("data-review")).toBe("approved");
  expect(within(canvas).getByText("sur release/1.2")).toBeTruthy();
  expect(within(canvas).queryByText("sur dev")).toBeNull();
});

test("arrows walk up, down and across the stacks, Enter opens the ticket", async () => {
  const m = setup();
  await region();
  card(22).focus();
  const expectFocus = (n: number) => expect(document.activeElement?.getAttribute("data-pr")).toBe(String(n));
  await userEvent.keyboard("{ArrowUp}");
  expectFocus(24);
  await userEvent.keyboard("{ArrowUp}");
  expectFocus(25);
  await userEvent.keyboard("{ArrowUp}");
  expectFocus(25);
  await userEvent.keyboard("{ArrowDown}");
  expectFocus(24);
  await userEvent.keyboard("{ArrowRight}");
  expectFocus(20);
  await userEvent.keyboard("{ArrowRight}");
  expectFocus(23);
  await userEvent.keyboard("{ArrowLeft}");
  expectFocus(20);
  await userEvent.keyboard("{ArrowLeft}");
  expectFocus(22);
  await userEvent.keyboard("{Enter}");
  expect(m.opened).toEqual([ticket(m, "Route d'envoi des photos").id]);
  expect(screen.getByText("Flèches : PR du dessus, du dessous, pile voisine · Entrée : ouvrir")).toBeTruthy();
});

test("the view opens at the bottom, rail in sight", async () => {
  const proto = HTMLElement.prototype;
  const scroll = Object.getOwnPropertyDescriptor(proto, "scrollHeight");
  const client = Object.getOwnPropertyDescriptor(proto, "clientHeight");
  Object.defineProperty(proto, "scrollHeight", { configurable: true, get: () => 1400 });
  Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => 900 });
  try {
    setup();
    const canvas = await region();
    expect(canvas.scrollTop).toBe(500);
  } finally {
    if (scroll) Object.defineProperty(proto, "scrollHeight", scroll);
    if (client) Object.defineProperty(proto, "clientHeight", client);
  }
});
