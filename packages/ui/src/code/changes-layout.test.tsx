import { expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChangesLayout } from "./ChangesLayout";

const show = () =>
  render(
    <ChangesLayout
      files={<p>Liste</p>}
      diff={<p>Diff</p>}
      commit={<p>Commit</p>}
      filesTitle="Fichiers (3)"
    />,
  );

test("three columns from lg, the three zones rendered in order", () => {
  const { container } = show();
  expect(container.firstElementChild?.className).toContain("lg:grid-cols-[272px_minmax(0,1fr)_340px]");
  const order = ["Liste", "Diff", "Commit"].map((text) => screen.getByText(text));
  expect(order[0]?.compareDocumentPosition(order[1] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(order[1]?.compareDocumentPosition(order[2] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

test("below lg the file list folds behind its title, open by default", () => {
  show();
  const toggle = screen.getByRole("button", { name: "Fichiers (3)" });
  expect(toggle.className).toContain("lg:hidden");
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  const list = screen.getByText("Liste").closest("[data-state]");
  expect(list?.getAttribute("data-state")).toBe("closed");
  expect(list?.className).toContain("data-[state=closed]:max-lg:hidden");
});
