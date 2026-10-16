import { expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FeatureChip } from "./FeatureChip";

const F5 = { id: "f5", keyLabel: "EMIS-30", shortKey: "F5", title: "Envoyer les photos d'un tronçon" };

test("the chip reads short key then name on one line, shows the full name on hover and opens the feature", async () => {
  const opened: string[] = [];
  render(<FeatureChip feature={F5} onOpen={(id) => opened.push(id)} />);
  const chip = screen.getByRole("button", {
    name: "Ouvrir la fonctionnalité F5 · Envoyer les photos d'un tronçon",
  });
  const text = chip.querySelector("[data-slot=feature-name]");
  expect(text?.textContent).toBe("F5 · Envoyer les photos d'un tronçon");
  expect(text?.className).toContain("truncate");
  act(() => {
    fireEvent.focus(chip);
  });
  expect((await screen.findByRole("tooltip")).textContent).toBe("F5 · Envoyer les photos d'un tronçon");
  fireEvent.click(chip);
  expect(opened).toEqual(["f5"]);
});

test("a feature without short key falls back to its key", () => {
  render(<FeatureChip feature={{ ...F5, shortKey: null }} onOpen={() => undefined} />);
  expect(
    screen.getByRole("button", {
      name: "Ouvrir la fonctionnalité EMIS-30 · Envoyer les photos d'un tronçon",
    }),
  ).toBeTruthy();
});
