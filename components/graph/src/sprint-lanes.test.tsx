import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SprintLanes } from "./SprintLanes";
import { sprintLanes } from "./sprint-lanes";
import { kitInput } from "./sprint-lanes-kit";

afterEach(cleanup);

test("lane headers are sticky, opaque and underlined", () => {
  render(
    <SprintLanes model={sprintLanes(kitInput())} onOpen={() => undefined} onNewFeature={() => undefined} />,
  );
  for (const lane of screen.getAllByRole("group")) {
    const header = lane.querySelector("[data-slot='lane-header']");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    expect(header?.className).toContain("border-b");
    expect(header?.className).toMatch(/bg-\(--tracking-(panel|canvas)\)/);
    for (const text of Array.from(header?.querySelectorAll(".truncate") ?? []))
      expect(text.getAttribute("title")).toBe(text.textContent);
  }
});
