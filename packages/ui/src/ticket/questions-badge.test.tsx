import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionsBadge } from "./QuestionsBadge";

test("the badge counts open questions in orange and opens the view", async () => {
  let opened = 0;
  const { rerender, container } = render(<QuestionsBadge count={1} onOpen={() => opened++} />);
  const one = screen.getByRole("button", { name: "1 question" });
  expect(one.className).toContain("text-orange-600");
  expect(one.className).toContain("dark:text-orange-400");
  expect(one.querySelector("svg")).toBeTruthy();
  await userEvent.setup().click(one);
  expect(opened).toBe(1);
  rerender(<QuestionsBadge count={2} onOpen={() => opened++} />);
  expect(screen.getByRole("button", { name: "2 questions" })).toBeTruthy();
  rerender(<QuestionsBadge count={0} onOpen={() => opened++} />);
  expect(container.childElementCount).toBe(0);
});
