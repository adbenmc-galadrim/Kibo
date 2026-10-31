import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SprintRecapCard } from "../tracking/SprintRecapCard";
import { CornerStack } from "./corner-stack";

afterEach(cleanup);

const RECAP = {
  code: "S42",
  name: "Saisie hors ligne",
  start: "2026-10-12",
  end: "2026-10-16",
  delivered: [],
  mergedSteps: 1,
  plannedSteps: 2,
  capacity: 5,
  slipped: [],
  next: null,
};

test("a toast and the sprint recap share one stacked corner, so they never overlap", () => {
  render(
    <>
      <CornerStack>
        <output>toast</output>
      </CornerStack>
      <SprintRecapCard recap={RECAP} onOpenPlanning={() => undefined} onClose={() => undefined} />
    </>,
  );
  const card = screen.getByRole("region", { name: "Sprint S42 terminé" });
  const stack = screen.getByRole("status").parentElement;
  expect(card.parentElement).toBe(stack);
  expect(stack?.className).toContain("fixed");
  expect(stack?.className).toContain("flex-col");
  expect(card.className).not.toContain("fixed");
});

test("two stacks reuse the same element", () => {
  render(
    <>
      <CornerStack>
        <p>a</p>
      </CornerStack>
      <CornerStack>
        <p>b</p>
      </CornerStack>
    </>,
  );
  expect(screen.getByText("a").parentElement).toBe(screen.getByText("b").parentElement);
  expect(document.querySelectorAll("[data-slot=corner-stack]").length).toBe(1);
});
