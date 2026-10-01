import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SettingsLayout } from "./SettingsLayout";

test("the navigation sits in a column from md and stacks above the content below", () => {
  const { container } = render(
    <SettingsLayout active="general">
      <p>Contenu</p>
    </SettingsLayout>,
  );
  const layout = container.firstElementChild;
  expect(layout?.className).toContain("md:grid-cols-[14rem_1fr]");
  expect(layout?.className.split(" ")).not.toContain("grid-cols-[14rem_1fr]");
  const nav = screen.getByRole("navigation", { name: "Paramètres" });
  const content = screen.getByText("Contenu");
  expect(nav.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(nav.getAttribute("aria-label")).toBe("Paramètres");
});
