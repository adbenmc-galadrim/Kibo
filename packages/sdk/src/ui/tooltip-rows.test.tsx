import { afterEach, expect, test } from "bun:test";
import { TooltipRows } from "@kibo/sdk/ui/tooltip-rows";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(cleanup);

const panel = () => document.querySelector('[data-slot="tooltip-rows"]');

test("renders children alone when rows is empty", () => {
  const { container } = render(
    <TooltipRows rows={[]}>
      <button type="button">Carte</button>
    </TooltipRows>,
  );
  expect(container.innerHTML).toBe('<button type="button">Carte</button>');
  fireEvent.focus(screen.getByRole("button"));
  expect(panel()).toBeNull();
});

test("shows one label and one value per row when the trigger takes the focus", async () => {
  render(
    <TooltipRows
      rows={[
        ["Branche", "feat/envoi"],
        ["Questions", "1 ouverte"],
      ]}
    >
      <button type="button">Carte</button>
    </TooltipRows>,
  );
  fireEvent.focus(screen.getByRole("button"));
  await waitFor(() => expect(panel()).not.toBeNull());
  expect(panel()?.textContent).toContain("Branche");
  expect(panel()?.textContent).toContain("feat/envoi");
  expect(panel()?.textContent).toContain("1 ouverte");
});

test("a suppressed tooltip stays closed", () => {
  render(
    <TooltipRows rows={[["Branche", "feat/envoi"]]} suppressed>
      <button type="button">Carte</button>
    </TooltipRows>,
  );
  fireEvent.focus(screen.getByRole("button"));
  expect(panel()).toBeNull();
});
