import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FrameStepRow } from "./FrameStepRow";
import type { LaneStep } from "./sprint-lanes";

afterEach(cleanup);

const step: LaneStep = {
  ticketId: "t",
  key: "SILO-1",
  title: "Conflits de saisie",
  tone: "review",
  git: { kind: "pr", tone: "purple" },
  session: false,
  hold: { source: "own", reason: "Client", key: "", since: "2026-10-01" },
  startable: false,
};

const renderRow = (onOpen: (id: string) => void = () => undefined) => {
  render(
    <ul>
      <FrameStepRow step={step} onOpen={onOpen} />
    </ul>,
  );
  return screen.getByRole("listitem");
};

test("dots are 10 px, icons 15 px", () => {
  const row = renderRow();
  expect(row.querySelector("[data-tone]")?.className).toContain("size-2.5");
  const icons = Array.from(row.querySelectorAll("svg"));
  expect(icons).toHaveLength(2);
  for (const icon of icons) expect(icon.getAttribute("width")).toBe("15");
});

test("the row height is 28 and the whole row is a hit area of at least 24 × 24", () => {
  const row = renderRow();
  expect(row.className).toContain("h-7");
  const button = screen.getByRole("button");
  expect(button.className).toContain("size-full");
  expect(button.contains(row.querySelector("[data-tone]"))).toBe(true);
  for (const icon of Array.from(row.querySelectorAll("svg"))) expect(button.contains(icon)).toBe(true);
});

test("clicking a mark opens the step", async () => {
  const opened: string[] = [];
  const row = renderRow((id) => opened.push(id));
  const icon = row.querySelector("svg");
  if (icon === null) throw new Error("missing icon");
  await userEvent.click(icon);
  expect(opened).toEqual(["t"]);
});
