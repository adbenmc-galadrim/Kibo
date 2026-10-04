import { expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { SelectionChip } from "./selection-chip";

test("the chip renders nothing without a selection", () => {
  const { container } = render(<SelectionChip selection={null} onClear={() => undefined} />);
  expect(container.childElementCount).toBe(0);
});

test("the chip counts the selection and clears it", () => {
  let cleared = 0;
  render(<SelectionChip selection={{ kind: "ticket", ids: ["a", "b", "c"] }} onClear={() => cleared++} />);
  expect(screen.getByRole("status").textContent).toContain("3 sélectionnés");
  fireEvent.click(screen.getByRole("button", { name: "Effacer la sélection" }));
  expect(cleared).toBe(1);
});

test("a single selected ticket is singular", () => {
  render(<SelectionChip selection={{ kind: "ticket", ids: ["a"] }} onClear={() => undefined} />);
  expect(screen.getByRole("status").textContent).toContain("1 sélectionné");
  expect(screen.getByRole("status").textContent).not.toContain("sélectionnés");
});
