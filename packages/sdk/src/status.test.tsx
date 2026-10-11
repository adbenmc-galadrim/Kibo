import { expect, test } from "bun:test";
import { RunState, StatusId } from "@kibo/schema";
import { render } from "@testing-library/react";
import { RUN_TEXT, RunDot, StatusDot, statusCardClass, statusDotClass } from "./status";

test("every status has a hidden round dot, backlog is a ring", () => {
  for (const id of StatusId.options) {
    const { container, unmount } = render(<StatusDot statusId={id} />);
    const dot = container.firstElementChild;
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(dot?.className).toContain("rounded-full");
    const ring = dot?.className.includes("bg-transparent") ?? false;
    expect(ring).toBe(id === "backlog");
    unmount();
  }
});

test("every run state has a dot; queued is cyan, waiting amber", () => {
  for (const state of RunState.options) {
    const { container, unmount } = render(<RunDot state={state} />);
    const dot = container.firstElementChild;
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    expect(dot?.getAttribute("data-state")).toBe(state);
    expect(RUN_TEXT[state].length).toBeGreaterThan(0);
    unmount();
  }
  const { container } = render(<RunDot state="queued" />);
  expect(container.firstElementChild?.className).toContain("bg-cyan-500");
  expect(RUN_TEXT.waiting_input).toContain("text-amber-700");
  expect(RUN_TEXT.queued).toContain("text-cyan-700");
});

test("statusDotClass gives the StatusDot colour classes", () => {
  for (const id of StatusId.options) {
    const { container, unmount } = render(<StatusDot statusId={id} />);
    expect(container.firstElementChild?.className).toContain(statusDotClass(id));
    unmount();
  }
});

test("every status tints a whole card with a full border", () => {
  for (const id of StatusId.options) {
    expect(statusCardClass(id)).toContain("border-");
    expect(statusCardClass(id)).toContain("/15");
  }
  expect(statusCardClass("in_progress")).toContain("border-blue-600");
  expect(statusCardClass("done")).toContain("dark:border-green-500");
  expect(statusCardClass("backlog")).toBe(statusCardClass("todo"));
});
