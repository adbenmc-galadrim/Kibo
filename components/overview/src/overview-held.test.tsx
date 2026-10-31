import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeldCard } from "./HeldCard";
import { Component, manifest } from "./index";
import { HOLD_REASONS, NOW, seed, seedHeld, TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => {
  setSystemTime();
  cleanup();
});

function setup(held: boolean) {
  const m = createMockSdk(manifest, { seed: held ? seedHeld : seed, today: TODAY, folder: "/silo" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
}

const key = (m: ReturnType<typeof setup>, title: string) =>
  m.snapshot().tickets.find((t) => t.title === title)?.keyLabel ?? "";

test("the Fonctionnalités indicator says how many steps are on hold, and opens the Planning", async () => {
  const m = setup(true);
  const indicators = await screen.findByRole("region", { name: "Indicateurs du projet" });
  expect(within(indicators).getByText("livrées sur 9")).toBeTruthy();
  const held = within(indicators).getByRole("button", { name: "3 en attente" });
  expect(within(indicators).queryByText(/à risque/)).toBeNull();
  await userEvent.click(held);
  expect(m.viewRequests).toEqual([{ componentId: "planning", question: null }]);
});

test("the « En attente » card lists one line per reason, with its steps and their dependents", async () => {
  const m = setup(true);
  const card = await screen.findByRole("region", { name: "En attente" });
  expect(within(card).getByText("3")).toBeTruthy();
  expect(
    within(card).getByText("étapes mises de côté, par raison · à reprendre depuis le Planning"),
  ).toBeTruthy();
  const rows = within(card).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual([
    `${HOLD_REASONS.merge}${key(m, "Conflits de saisie")}`,
    `${HOLD_REASONS.minio}${key(m, "Écran d'envoi hors ligne")}, ${key(m, "PDF")}· 2 en dépendent`,
  ]);
  await userEvent.click(within(card).getByRole("button", { name: new RegExp(HOLD_REASONS.merge) }));
  expect(m.viewRequests).toEqual([{ componentId: "planning", question: null }]);
});

const HOLD = "text-(--tracking-hold)";

test("every feature with steps on hold says how many in the sprint card, in cyan", async () => {
  setup(true);
  const sprint = await screen.findByRole("region", { name: "Sprint S42 · Saisie hors ligne" });
  const row = (title: string) => {
    const li = within(sprint).getByText(title).closest("li");
    if (!(li instanceof HTMLElement)) throw new Error(`no row ${title}`);
    return li;
  };
  const f4 = row("Saisir un constat hors ligne");
  expect(within(f4).getByText("livrée")).toBeTruthy();
  expect(within(f4).getByRole("img", { name: "1 étape en attente" }).className).toContain(HOLD);
  const f5 = row("Envoyer les photos d'un constat");
  expect(within(f5).getByRole("img", { name: "3 étapes en attente" }).className).toContain(HOLD);
  const tones = Array.from(f5.querySelectorAll('[data-slot="segments"] > span')).map((s) =>
    s.getAttribute("data-tone"),
  );
  expect(tones).toEqual(["done", "review", "hold", "hold", "hold"]);
  expect(within(row("Réaffecter un box")).queryByRole("img", { name: /en attente/ })).toBeNull();
});

test("the held sub-line and the held rows wear the hold color", async () => {
  setup(true);
  const indicators = await screen.findByRole("region", { name: "Indicateurs du projet" });
  expect(within(indicators).getByRole("button", { name: "3 en attente" }).className).toContain(HOLD);
  const card = await screen.findByRole("region", { name: "En attente" });
  const icons = within(card)
    .getAllByRole("listitem")
    .map((li) => li.querySelector("svg")?.getAttribute("class") ?? "");
  expect(icons).toHaveLength(2);
  for (const icon of icons) expect(icon).toContain(HOLD);
});

test("without any hold there is neither a sub-line nor a card", async () => {
  setup(false);
  const indicators = await screen.findByRole("region", { name: "Indicateurs du projet" });
  expect(within(indicators).getByText("2 à risque")).toBeTruthy();
  expect(within(indicators).queryByRole("button", { name: /en attente/ })).toBeNull();
  expect(screen.queryByRole("region", { name: "En attente" })).toBeNull();
  expect(screen.queryByRole("img", { name: /en attente/ })).toBeNull();
});

test("the title of En attente stays on one line and its long subtitle is the one cut", () => {
  render(
    <HeldCard
      rows={[{ reason: "Serveur", keys: ["SILO-33"], dependents: 0 }]}
      onOpenPlanning={() => undefined}
    />,
  );
  expect(screen.getByRole("heading", { name: "En attente" }).className).toContain("whitespace-nowrap");
  expect(screen.getByText(/étapes mises de côté/).className).toContain("truncate");
});
