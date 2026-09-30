import { expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { ShortcutsPage } from "./ShortcutsPage";

test("the shortcuts page lists the groups with kbd keys and an active nav entry (screen 77)", () => {
  render(<ShortcutsPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Raccourcis" })).toBeTruthy();
  const nav = screen.getByRole("navigation", { name: "Paramètres" });
  expect(within(nav).getByRole("link", { name: "Raccourcis" }).getAttribute("aria-current")).toBe("page");
  const navigation = screen.getByRole("region", { name: "Navigation" });
  const row = within(navigation).getByText("Aller à un onglet").closest("li");
  expect(row?.querySelectorAll("kbd")).toHaveLength(2);
  expect(row?.textContent).toContain("…");
  expect(screen.getByRole("region", { name: "Palette" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Code" })).toBeTruthy();
  expect(within(nav).queryByRole("button")).toBeNull();
});
