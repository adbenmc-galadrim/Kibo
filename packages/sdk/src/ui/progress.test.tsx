import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Progress } from "./progress";

test("Progress exposes its value to assistive technologies", () => {
  render(<Progress aria-label="Envoi" value={42} />);
  const bar = screen.getByRole("progressbar", { name: "Envoi" });
  expect(bar.getAttribute("aria-valuenow")).toBe("42");
  expect(bar.getAttribute("data-state")).toBe("loading");
});
