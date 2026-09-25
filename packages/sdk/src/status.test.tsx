import { expect, test } from "bun:test";
import { StatusId } from "@kibo/schema";
import { render } from "@testing-library/react";
import { StatusDot } from "./status";

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
