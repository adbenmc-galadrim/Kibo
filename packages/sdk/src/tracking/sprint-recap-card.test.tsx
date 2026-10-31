import { afterEach, expect, mock, test } from "bun:test";
import type { SprintRecap } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SprintRecapCard } from "./SprintRecapCard";

afterEach(cleanup);

const RECAP: SprintRecap = {
  code: "S42",
  name: "Saisie hors ligne",
  start: "2026-10-12",
  end: "2026-10-16",
  delivered: [{ label: "F3", title: "Réaffecter un box" }],
  mergedSteps: 8,
  plannedSteps: 14,
  capacity: 5,
  slipped: [{ label: "F5", remaining: 4, keys: [], to: "S43" }],
  next: { code: "S43", start: "2026-10-19", end: "2026-10-23", plannedSteps: 8 },
};

test("the card reads the sprint, its three lines and the next sprint", () => {
  render(<SprintRecapCard recap={RECAP} onOpenPlanning={() => undefined} onClose={() => undefined} />);
  const card = screen.getByRole("region", { name: "Sprint S42 terminé" });
  expect(card.textContent).toContain("12–16 oct.");
  expect(card.textContent).toContain("1 fonctionnalité livréeF3 Réaffecter un box");
  expect(card.textContent).toContain("8 étapes fusionnéessur 14 prévues · capacité 5");
  expect(card.textContent).toContain("F5 passe en S434 étapes restantes");
  expect(card.textContent).toContain("Suivant : S43 · 19–23 oct. · 8 étapes prévues");
});

test("a sprint without a next one has no footer text and its leftovers stay put", () => {
  const alone = { ...RECAP, next: null, slipped: [{ label: "F5", remaining: 1, keys: [], to: null }] };
  render(<SprintRecapCard recap={alone} onOpenPlanning={() => undefined} onClose={() => undefined} />);
  const card = screen.getByRole("region", { name: "Sprint S42 terminé" });
  expect(card.textContent).not.toContain("Suivant");
  expect(card.textContent).toContain("F5 reste à finir1 étape restante");
});

test("the planning link and the close button call back", async () => {
  const open = mock(() => undefined);
  const close = mock(() => undefined);
  render(<SprintRecapCard recap={RECAP} onOpenPlanning={open} onClose={close} />);
  await userEvent.click(screen.getByRole("button", { name: /Ouvrir le planning/ }));
  await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});
